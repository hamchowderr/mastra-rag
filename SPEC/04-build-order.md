# 04 — Build Order

Strict order. Each phase has a verification checkpoint. Don't proceed past a failing checkpoint without flagging in `PROGRESS.md`.

## Phase 0: Fork base via degit

```bash
cd C:\Users\HamCh\code
npx degit hamchowderr/template-mastra-base template-mastra-rag
cd template-mastra-rag
npm install
```

**Wait** — that will overwrite the SPEC folder you're reading. Instead:

1. Move the existing SPEC folder out of the way:
   ```bash
   cd C:\Users\HamCh\code\template-mastra-rag
   move SPEC SPEC.tmp
   ```

2. Run degit (it works on existing dirs but won't overwrite without `--force`):
   ```bash
   npx degit hamchowderr/template-mastra-base . --force
   ```

3. Restore the SPEC folder:
   ```bash
   rmdir /s /q SPEC
   move SPEC.tmp SPEC
   ```

4. Install deps:
   ```bash
   npm install
   ```

**Checkpoint**:
- `ls` shows base's structure (src/, scripts/, Dockerfile, etc.) plus your SPEC folder
- `node_modules/` populated
- `npm run typecheck` passes
- `src/mastra/lib/processors.ts` and `src/mastra/lib/memory.ts` are inherited from base unchanged — keep them. The KB agent (Phase 8) wires both in.

## Phase 1: Strip the lead-intake assets

Delete:
- `src/mastra/agents/_example.ts`
- `src/mastra/scorers/_example.scorers.ts`
- `src/mastra/scorers/datasets/_example.json`

Replace `src/mastra/index.ts` with a minimal placeholder so the project still compiles:

```typescript
import { env } from '../lib/env';
import { configureAIMock } from './lib/aimock';
configureAIMock();

import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore } from '@mastra/pg';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraCompositeStore } from '@mastra/core/storage';
import { Observability, DefaultExporter, SensitiveDataFilter } from '@mastra/observability';

export const mastra = new Mastra({
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new PostgresStore({ id: 'mastra-storage', connectionString: env.SUPABASE_DB_URL }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    },
  }),
  logger: new PinoLogger({ name: 'Mastra', level: env.LOG_LEVEL }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new DefaultExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
```

**Checkpoint**: `npm run typecheck` passes.

## Phase 2: Install @mastra/rag and supabase migration

```bash
npm install @mastra/rag
```

Create `supabase/migrations/0001_pgvector.sql` per spec.

If using local Supabase (started via `npx supabase start`):

```bash
npx supabase db reset
```

For remote Supabase or other Postgres:

```bash
psql -f supabase/migrations/0001_pgvector.sql "$SUPABASE_DB_URL"
```

**Checkpoint**:
- `npm list @mastra/rag` shows the package installed
- `psql "$SUPABASE_DB_URL" -c "SELECT * FROM pg_extension WHERE extname='vector'"` returns one row

## Phase 3: Extend env loader

1. Update `src/lib/env.ts` per spec — add the five new RAG fields.
2. Update `.env.example` per spec — append the RAG section.
3. Update your local `.env` to set `RAG_INDEX_NAME=mastra_docs` and accept defaults for the rest.

**Checkpoint**: `npm run typecheck` passes.

## Phase 4: Add the corpus

1. Create `data/corpus/` directory.
2. Create the four markdown files per spec:
   - `data/corpus/overview.md`
   - `data/corpus/chunking-and-embedding.md`
   - `data/corpus/vector-databases.md`
   - `data/corpus/retrieval.md`
3. Populate from the conversation transcript (or fetch from `https://mastra.ai/docs/rag/...`).
4. **Verify** each file is real markdown, not a stub. `wc -l data/corpus/*.md` should show meaningful line counts (each file is at least 50 lines).

**Checkpoint**:
- Four `.md` files exist and contain real Mastra documentation content
- Total size > 10KB (`du -sh data/corpus/`)

## Phase 5: Ingestion script

1. Write `scripts/ingest.ts` per spec.
2. Add `"ingest": "tsx scripts/ingest.ts"` to `package.json` scripts.
3. Run it:
   ```bash
   npm run ingest
   ```

**Checkpoint**:
- Exit 0
- Logs show progress per file (e.g., "overview.md: 8 chunks", "Upserted 47 vectors")
- Verify in Postgres:
  ```bash
  psql "$SUPABASE_DB_URL" -c "SELECT count(*) FROM mastra_docs"
  ```
  Should show > 0 rows.
- Re-run `npm run ingest`. Exit 0 with no duplicate vectors (idempotent — count stays the same).

## Phase 6: Retrieval tool

Write `src/mastra/tools/retrieve.ts` per spec.

**Checkpoint**: `npm run typecheck` passes.

## Phase 7: RAG scorers

1. Inspect `node_modules/@mastra/evals/dist/scorers/prebuilt/` to confirm exact exports.
2. Write `src/mastra/scorers/_example.scorers.ts` per spec.

**Checkpoint**: `npm run typecheck` passes. All three scorers exportable.

## Phase 8: Knowledge-base agent

1. Write `src/mastra/agents/_example.ts` per spec — including `memory: createDefaultMemory()` and the shared `inputProcessors` / `outputProcessors` from `lib/`.
2. Update `src/mastra/index.ts` to:
   - Add `vectors: { pgVector: new PgVector({...}) }` to the Mastra config
   - Import and register `knowledgeBaseAgent`
   - Import and register the three scorers

**Checkpoint**:
1. `npm run typecheck` passes
2. `npm run dev` boots Studio at localhost:4111
3. Studio shows `knowledgeBase` agent
4. **Live smoke test**: chat with the agent in Studio. Send "How do I chunk markdown documents?" — agent should call retrieve, return chunks, and answer with source citations
5. cURL test:
   ```bash
   curl -X POST http://localhost:4111/api/agents/knowledgeBase/generate \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"What vector databases does Mastra support?"}]}'
   ```
   Should return an answer mentioning multiple vector stores with `[source: vector-databases.md]` citations.

## Phase 9: Eval dataset and runner

1. Write `src/mastra/scorers/datasets/_example.json` per spec.
2. Update `scripts/eval.ts` to handle the new schema (`expectedSourceFile`, `expectedKeywords`, `expectedRefusal`).
3. Run:
   ```bash
   npm run eval
   ```

**Checkpoint**:
- All 5 cases run
- Live mode (real OpenAI key): scorers report scores, all clear thresholds, exit 0
- AIMock mode (`USE_AIMOCK=true`): keyword/citation assertions run, scorers skipped, exit 0
- Exit 1 with clear reasons if any case or scorer threshold fails

## Phase 10: Docker

The base Dockerfile inherits unchanged. Verify:

```bash
docker build -t template-mastra-rag:test .
docker compose up -d
sleep 15
curl http://localhost:4111/health
docker compose down
```

**Checkpoint**: Container builds, starts, /health returns 200.

Note: Docker container won't have the corpus ingested by default. Either:
- Document that ingestion happens before the container is built (the corpus ships in the image)
- Add a startup script that runs ingestion if the index is empty

For v1, document. Don't add startup ingestion — it complicates the deploy story.

## Phase 11: CI workflow

Update `.github/workflows/ci.yml` per spec. Key change: eval job now needs a Postgres service container with pgvector, plus a migration step + ingest step before eval.

**Checkpoint**: This phase is verified at PR-time (push to GitHub, watch CI run).

## Phase 12: Documentation

Per spec:
1. Rewrite `README.md` for RAG focus
2. Update `AGENTS.md` with RAG conventions
3. Write `prompts/build-rag-agent.md`
4. Update `prompts/README.md` index

**Checkpoint**: A new dev can run quickstart end-to-end from the README alone.

## Phase 13: Final verification

Run through `05-verification.md` end-to-end. Document any failures in `PROGRESS.md`.
