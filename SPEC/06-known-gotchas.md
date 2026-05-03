# 06 — Known Gotchas

Pitfalls discovered during template scoping. Read before debugging anything weird.

## Inherited from base

All gotchas from `template-mastra-base/SPEC/06-known-gotchas.md` apply here. Re-read those if you haven't.

The high-impact ones for this template:

1. **AIMock requires OpenAI**. Do not switch the KB agent or the scorer judges to Anthropic — AIMock won't intercept those calls and CI will hit real APIs.
2. **Path aliases break inside `src/mastra/`**. Relative imports only.
3. **PostgresStore and PgVector both require `id` field**. Don't omit it.
4. **DuckDB requires glibc**. Don't change the Dockerfile back to Alpine.
5. **PostHog telemetry leaks errors in restricted networks**. Set `MASTRA_TELEMETRY_DISABLED=1`.

## RAG-specific gotchas

### Pgvector extension must be enabled BEFORE creating an index

`@mastra/pg`'s `PgVector.createIndex` will silently fail or produce cryptic errors if the `vector` extension isn't enabled in the database. The migration in `supabase/migrations/0001_pgvector.sql` handles this — run it before first ingest.

If you see "type vector does not exist" or similar, the extension isn't enabled. Run the migration.

### Embedding dimension must match index dimension

`text-embedding-3-small` outputs 1536-dimensional vectors. The pgvector index must be created with `dimension: 1536`. Mismatch produces "dimension mismatch" errors at upsert time.

If you change `RAG_EMBEDDING_MODEL` to a different model, you MUST:
1. Drop the existing index: `DROP TABLE mastra_docs;`
2. Update the dimension constant in `scripts/ingest.ts`
3. Re-run `npm run ingest`

There's no in-place migration. Document this clearly in README.

### MDocument.fromMarkdown vs fromText

Use `MDocument.fromMarkdown(content)` for markdown corpus — it preserves header/list structure and works well with the `markdown` chunking strategy. `fromText` would treat markdown as plain text and miss structural cues.

### Chunking strategy: 'markdown' vs 'semantic-markdown'

The `markdown` strategy splits on header boundaries with size limits. The `semantic-markdown` strategy uses LLM analysis to find related header families — better quality but uses LLM calls during ingestion (more expensive, slower).

For v1, use `markdown`. If retrieval quality is poor, switch to `semantic-markdown` per project.

### Idempotent ingestion requires deterministic IDs

If `scripts/ingest.ts` doesn't provide `ids` to `upsert`, pgvector generates new UUIDs each time, producing duplicates on re-runs. The spec uses `sha256(filename + chunkIndex)` as the deterministic ID. Don't remove this — re-running ingest is a common operation and should be safe.

### Vector store name must match between init and tool

In `src/mastra/index.ts`:
```typescript
vectors: { pgVector: new PgVector({...}) }
```

In `src/mastra/tools/retrieve.ts`:
```typescript
createVectorQueryTool({ vectorStoreName: 'pgVector', ... })
```

The string `'pgVector'` must match. Typos here produce "vector store not found" errors at runtime, not compile time.

### Supabase pooler and pgvector have specific connection caveats

Use the **session pooler** connection string (not transaction pooler). Transaction pooler doesn't preserve session state between queries, which breaks pgvector's prepared statements.

If you see weird intermittent errors during ingestion, check `SUPABASE_DB_URL` — it should point at the session pooler (port `5432`), not the transaction pooler (port `6543`).

### `createVectorQueryTool` returns scores 0-1, but pgvector's native distance is 0-2

`@mastra/pg`'s `PgVector` normalizes pgvector cosine distance into similarity scores in the 0-1 range. Don't be confused if you see scores like `0.89` from the tool and `0.22` if you query pgvector directly — the tool's score is `1 - cosine_distance`.

This matters when setting `minScore` thresholds via `databaseConfig.pgvector.minScore`. Use the 0-1 range.

### KB agent answers without retrieving (sometimes)

Even with explicit instructions to always call retrieve, models sometimes answer from training data when the question is "easy" (e.g., "what is RAG?"). Mitigations:

1. Make instructions more emphatic (e.g., "You MUST call retrieve before EVERY answer. No exceptions.")
2. Add a code-based scorer that asserts the retrieve tool was called (Mastra has `createToolCallAccuracyScorerCode` — check if it suits)
3. Use a smaller model — small models tend to follow instructions more literally

For v1, just emphatic instructions. Tighten if eval gate fails on tool-call assertions.

### `PGVECTOR_PROMPT` import path

The base build noted Mastra's package export maps can be inconsistent. The retrieval doc says:

```typescript
import { PGVECTOR_PROMPT } from '@mastra/pg';
```

Verify this path against `node_modules/@mastra/pg/dist/index.d.ts` before assuming. If it's not there, check `@mastra/pg/prompts` or similar subpath. Failing that, hardcode the prompt content into the agent's instructions — it's a small string.

### Local Supabase on Windows + Docker requires `host.docker.internal`

If you're running local Supabase via `npx supabase start` and trying to reach it from a Mastra container, `localhost` from inside the container points at the container, not the host. Use `host.docker.internal:54322` instead.

This was inherited from base; flagging again here because RAG eval in CI uses a Postgres service container and the connection string differs from local development.

### CI Postgres service container needs pgvector image

Plain `postgres:16` doesn't have pgvector. Use `pgvector/pgvector:pg16` for the CI service container. The migration step then succeeds.

### MDocument chunking can return zero chunks for very short files

If a file is shorter than the chunk size, `doc.chunk()` may return one chunk containing the whole file. That's fine. But if a file is empty (0 bytes), it can return zero chunks and `embedMany` will fail with "no values provided." Validate that each file has content before chunking — skip empty files with a warning.

### `embedMany` rate limits

OpenAI's embedding endpoint has rate limits. For a small corpus (~50 chunks), this isn't an issue. For larger corpora (1000+ chunks), batch the embeddings (e.g., 100 at a time) and add retries. Out of scope for v1, but flag it for clients with large corpora.

### `text-embedding-3-small` vs `-large`

`-small` is 1536 dim, `-large` is 3072 dim. The defaults in this template use `-small` because it's cheaper and accurate enough for most use cases. If a client has stringent retrieval quality requirements, switch to `-large` — but remember the dimension change requires dropping and re-creating the index (see above).
