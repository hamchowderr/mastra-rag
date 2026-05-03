# 03 — File Specifications

Each section specifies one file. Implement in the order given by `04-build-order.md`. The base template's specs apply where this file says "inherited" — don't rewrite those.

---

## `supabase/migrations/0001_pgvector.sql`

**Purpose**: Enables the pgvector extension in the project's Postgres database.

**Implementation**:

```sql
-- Enable pgvector extension for vector similarity search
-- Required by @mastra/pg's PgVector class for RAG operations
CREATE EXTENSION IF NOT EXISTS vector;
```

**How to apply**:

The owner uses Supabase locally (started via Docker, per base build's PROGRESS.md). Migrations are applied via `npx supabase db reset` for local or `npx supabase db push` for hosted projects.

For non-Supabase Postgres deployments (e.g., a client using bare DigitalOcean Managed Postgres), the migration runs as plain SQL via psql. Document this in README.

**Acceptance criteria**:
- File exists at the path above
- `psql -f supabase/migrations/0001_pgvector.sql $SUPABASE_DB_URL` runs without error
- After application, `SELECT * FROM pg_extension WHERE extname = 'vector'` returns one row

---

## `data/corpus/*.md`

**Purpose**: Frozen markdown corpus the KB agent answers questions about.

**Source**: Four Mastra RAG documentation pages provided by the owner in the conversation transcript:

1. **`overview.md`** — RAG (Retrieval-Augmented Generation) in Mastra (the high-level overview page)
2. **`chunking-and-embedding.md`** — Chunking and embedding documents
3. **`vector-databases.md`** — Storing embeddings in a vector database
4. **`retrieval.md`** — Retrieval in RAG systems

**Implementation**: Create the directory and copy the four markdown files verbatim from the conversation transcript. If you don't have access to the transcript, fetch them from Mastra's documentation site at:

- `https://mastra.ai/docs/rag/overview`
- `https://mastra.ai/docs/rag/chunking-and-embedding`
- `https://mastra.ai/docs/rag/vector-databases`
- `https://mastra.ai/docs/rag/retrieval`

Save the raw markdown (not HTML) as plain text files in `data/corpus/`. Filename convention: kebab-case matching the URL slug.

**Important — do NOT include**:
- The GraphRAG page (`graph-rag.md`) — explicitly out of scope per `01-context.md`
- HTML wrappers, navigation chrome, or footer content
- Anything that's not the actual documentation content

**Acceptance criteria**:
- Four `.md` files in `data/corpus/`
- Each file is plain markdown (starts with `#` heading, no HTML)
- Total size > 10KB combined (sanity check that content was actually copied, not stubbed)
- Files are checked into git (no .gitignore exclusions for `data/`)

---

## `src/lib/env.ts` (extended from base)

**Purpose**: Same as base, with new optional RAG vars added to the schema.

**What to add to the existing schema**:

```typescript
// In the .object({...}) block, add these fields:
RAG_INDEX_NAME: z.string().min(1).default('mastra_docs'),
RAG_TOP_K: z.coerce.number().int().min(1).max(50).default(5),
RAG_EMBEDDING_MODEL: z.string().min(1).default('openai/text-embedding-3-small'),
RAG_CHUNK_SIZE: z.coerce.number().int().min(50).max(8192).default(512),
RAG_CHUNK_OVERLAP: z.coerce.number().int().min(0).max(500).default(50),
```

Do NOT modify any existing fields. Do NOT remove the `.refine()` for at-least-one-LLM-key.

**Acceptance criteria**:
- All five new fields exist in the schema with the defaults shown
- Importing `env` from any other module exposes the new fields with correct types
- `npm run typecheck` passes

---

## `.env.example` (extended from base)

**Purpose**: Document the new RAG vars at the bottom of the existing file.

**What to add**:

```bash
# ──────────────────────────────────────────────
# RAG (optional — sensible defaults provided)
# ──────────────────────────────────────────────
# Pgvector index name. Change if you want multiple corpora in one DB.
RAG_INDEX_NAME=mastra_docs
# Number of chunks retrieved per query.
RAG_TOP_K=5
# Embedding model. Must match index dimension if changed.
RAG_EMBEDDING_MODEL=openai/text-embedding-3-small
# Max tokens per chunk.
RAG_CHUNK_SIZE=512
# Token overlap between adjacent chunks.
RAG_CHUNK_OVERLAP=50
```

**Acceptance criteria**:
- Section appended to the bottom of `.env.example`
- All five vars present with the values shown
- Existing base content unchanged

---

## `src/mastra/tools/retrieve.ts`

**Purpose**: Retrieval tool that the KB agent (and any future RAG agent) uses to query the vector store. Wraps Mastra's `createVectorQueryTool` with project-specific config.

**Behavior**:
- Reads `env.RAG_INDEX_NAME`, `env.RAG_EMBEDDING_MODEL`, `env.RAG_TOP_K` for defaults
- Returns top-K chunks with metadata (source file, chunk position) for citation
- Tool name: `retrieve` so agent invocations look natural in traces

**Implementation guidance**:
- Verify the actual signature of `createVectorQueryTool` by reading `node_modules/@mastra/rag/dist/...` types before writing.
- Use `ModelRouterEmbeddingModel` from `@mastra/core/llm` to construct the embedding model from the env string.

**Sketch**:

```typescript
import { createVectorQueryTool } from '@mastra/rag';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { env } from '../../lib/env';

/**
 * Retrieval tool for RAG agents. Performs semantic search over the
 * project's pgvector index and returns top-K chunks with source metadata.
 *
 * Configuration comes from env (RAG_INDEX_NAME, RAG_EMBEDDING_MODEL, RAG_TOP_K).
 *
 * Usage in an agent:
 *   tools: { retrieve }
 */
export const retrieve = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: env.RAG_INDEX_NAME,
  model: new ModelRouterEmbeddingModel(env.RAG_EMBEDDING_MODEL),
  // If the type def supports configurable topK at construct time, use env.RAG_TOP_K here.
  // Otherwise pass it via runtime context — see Mastra docs.
});
```

**Acceptance criteria**:
- Typecheck passes
- Importing `retrieve` and adding to an agent's `tools` config works without runtime errors
- When invoked with a query, returns an array of chunks with `text`, `score`, and `metadata` fields
- Metadata includes the source file path so the agent can cite

---

## `src/mastra/agents/_example.ts`

**Purpose**: Production knowledge-base agent. Replaces base's lead-intake agent. Uses RAG to answer questions about the corpus with source citations.

**Behavior**:
- Default model: `openai/gpt-5-mini` (or whatever current best-small OpenAI model is — check what works in base's CI eval and match)
- Has the `retrieve` tool
- Memory enabled (carries thread context)
- Three RAG scorers attached with `sampling: { type: 'ratio', rate: 1 }`
- Returns answers in plain text (NOT structured output) with inline source attributions

**Implementation**:

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import { retrieve } from '../tools/retrieve';
import {
  faithfulnessScorer,
  answerRelevancyScorer,
  contextRelevanceScorer,
} from '../scorers/_example.scorers';
import { PGVECTOR_PROMPT } from '@mastra/pg';

/**
 * # Knowledge Base Agent (canonical RAG example)
 *
 * What it does:
 *   Answers questions about Mastra's RAG documentation by retrieving
 *   relevant chunks from a pgvector index and grounding responses
 *   in the retrieved context. Cites source files inline.
 *
 * Who calls it:
 *   - Studio chat (development reference tool)
 *   - Next.js API routes
 *   - n8n / Make webhook (POST /api/agents/knowledgeBase/generate)
 *
 * Env vars required:
 *   - OPENAI_API_KEY (default model)
 *   - SUPABASE_DB_URL (vector store)
 *   - RAG_INDEX_NAME (defaults to mastra_docs)
 *
 * How to test:
 *   curl -X POST http://localhost:4111/api/agents/knowledgeBase/generate \
 *     -H "Content-Type: application/json" \
 *     -d '{
 *       "messages": [{
 *         "role": "user",
 *         "content": "How do I chunk markdown documents in Mastra?"
 *       }]
 *     }'
 *
 * Pre-flight:
 *   Run `npm run ingest` once to populate the vector index before first use.
 *
 * Copy this file, swap the corpus, and adapt instructions for new RAG agents.
 */

export const knowledgeBaseAgent = new Agent({
  id: 'knowledgeBase',
  name: 'Knowledge Base',
  instructions: `You answer questions about Mastra's RAG documentation using the retrieve tool to fetch relevant context.

Rules:
- ALWAYS call the retrieve tool before answering. Never answer from your own knowledge alone.
- If retrieve returns no relevant chunks, say so plainly. Do not guess or fabricate.
- Cite sources inline using the format: [source: <filename>] after each claim.
- If the user's question is ambiguous or too broad, ask one clarifying question rather than guessing intent.
- Keep answers concise. Most questions deserve 1-3 paragraphs, not essays.
- Use code examples directly from the retrieved context when relevant — don't paraphrase code.

${PGVECTOR_PROMPT}`,
  model: 'openai/gpt-5-mini',
  tools: { retrieve },
  memory: new Memory(),
  scorers: {
    faithfulness: {
      scorer: faithfulnessScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
    answerRelevancy: {
      scorer: answerRelevancyScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
    contextRelevance: {
      scorer: contextRelevanceScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
  },
});
```

**Implementation note on `PGVECTOR_PROMPT`**: This is exported from `@mastra/pg` and contains pgvector-specific filtering syntax that helps the agent construct correct metadata filter queries. Including it makes filtering work reliably. Verify the import path against the actual package types before writing.

**Acceptance criteria**:
- Agent registers without errors
- Live smoke test (real OpenAI key + ingested corpus) returns valid answers with source citations
- Studio shows the agent and lets you chat with it
- The `retrieve` tool is invoked on every question (visible in trace)
- Anti-hallucination: when asked about something outside the corpus (e.g., "What's the capital of France?"), agent says it can't answer from the docs rather than answering anyway

---

## `src/mastra/scorers/_example.scorers.ts`

**Purpose**: Three RAG-specific scorers from `@mastra/evals/scorers/prebuilt`.

**Implementation guidance**:
- Verify the prebuilt scorer signatures by reading `node_modules/@mastra/evals/dist/scorers/prebuilt/index.d.ts`
- The base build noted that `createPromptAlignmentScorer` exists; same package likely has `createFaithfulnessScorerLLM`, `createAnswerRelevancyScorerLLM`, `createContextRelevanceScorerLLM` (note: the LLM-judged versions). Confirm exact names before importing.
- All three need `model: '<provider>/<model-id>'`. Use OpenAI for AIMock compatibility (e.g., `openai/gpt-5-mini`).

**Sketch** (verify exact API before finalizing):

```typescript
import {
  createFaithfulnessScorerLLM,
  createAnswerRelevancyScorerLLM,
  createContextRelevanceScorerLLM,
} from '@mastra/evals/scorers/prebuilt';

const judgeModel = 'openai/gpt-5-mini';

export const faithfulnessScorer = createFaithfulnessScorerLLM({
  model: judgeModel,
});

export const answerRelevancyScorer = createAnswerRelevancyScorerLLM({
  model: judgeModel,
});

export const contextRelevanceScorer = createContextRelevanceScorerLLM({
  model: judgeModel,
});
```

**What each scorer measures**:
- **Faithfulness**: Does the answer stay faithful to the retrieved context? Detects hallucination relative to source material.
- **Answer Relevancy**: Does the answer address the question that was asked? Detects off-topic responses.
- **Context Relevance**: Were the retrieved chunks relevant to the question? Detects retrieval failures (good answers despite bad retrieval, or vice versa).

This triplet is the standard RAG eval pattern. Together they tell you whether retrieval, generation, or both are at fault when something goes wrong.

**Acceptance criteria**:
- Typecheck passes
- All three scorers exportable
- Each can be passed to an agent's `scorers` config without runtime errors

---

## `src/mastra/scorers/datasets/_example.json`

**Purpose**: Canonical eval dataset for the KB agent. Used by `scripts/eval.ts` for offline CI gating.

**Schema** (matches base's eval.ts contract — confirm by reading the base's eval.ts before writing):

```json
{
  "agentId": "knowledgeBase",
  "thresholds": {
    "faithfulness": 0.8,
    "answerRelevancy": 0.7,
    "contextRelevance": 0.6
  },
  "cases": [
    {
      "name": "chunking strategy question",
      "input": "What chunking strategies does Mastra support for documents?",
      "expectedSourceFile": "chunking-and-embedding.md",
      "expectedKeywords": ["recursive", "markdown", "sentence", "token"]
    },
    {
      "name": "vector store list question",
      "input": "Which vector databases does Mastra support?",
      "expectedSourceFile": "vector-databases.md",
      "expectedKeywords": ["PgVector", "Pinecone", "Qdrant", "Chroma"]
    },
    {
      "name": "embedding model dimension",
      "input": "What is the dimension of OpenAI's text-embedding-3-small?",
      "expectedSourceFile": "chunking-and-embedding.md",
      "expectedKeywords": ["1536"]
    },
    {
      "name": "metadata filtering syntax",
      "input": "How do I filter retrieval results by metadata?",
      "expectedSourceFile": "retrieval.md",
      "expectedKeywords": ["filter", "metadata", "$or", "$gt"]
    },
    {
      "name": "anti-hallucination: out-of-corpus question",
      "input": "What is the capital of France?",
      "expectedRefusal": true,
      "weight": 2
    }
  ]
}
```

The schema differs slightly from base's (which used `expectedFields` for structured output). Here we use:
- `expectedSourceFile`: name of the corpus file the answer should cite
- `expectedKeywords`: substring matches in the answer (case-insensitive)
- `expectedRefusal`: true if the agent should refuse rather than answer
- `weight`: optional weight for averaging (default 1)

The eval runner enforces these.

**Acceptance criteria**:
- Valid JSON, lints clean
- 5 cases minimum including 1 anti-hallucination case
- Eval runner consumes it without schema errors

---

## `scripts/ingest.ts`

**Purpose**: One-shot script that reads `data/corpus/*.md`, chunks each file, embeds chunks, and upserts to pgvector. Run before first KB agent use, and again whenever the corpus changes.

**Behavior**:
- Reads every `.md` file in `data/corpus/` (recursively if subdirectories exist)
- For each file:
  - Constructs an `MDocument` via `MDocument.fromMarkdown(content)`
  - Chunks with `markdown` strategy, `maxSize: env.RAG_CHUNK_SIZE`, `overlap: env.RAG_CHUNK_OVERLAP`
  - Generates embeddings via `embedMany` with the model from `env.RAG_EMBEDDING_MODEL`
  - Upserts to pgvector with metadata: `{ text, source, chunkIndex }`
- Creates the index on first run if it doesn't exist (dimension matches embedding model)
- Idempotent: re-running with the same corpus produces the same vectors (uses deterministic IDs based on source + chunkIndex)
- Logs progress: "Processing X.md... 12 chunks", "Upserted 47 vectors"
- Exit 0 on success, 1 on any error

**Implementation guidance**:
- Read `node_modules/@mastra/rag/dist/...` for the actual API of `MDocument` and chunking
- Read `node_modules/@mastra/pg/dist/...` for `PgVector.createIndex` and `.upsert` signatures
- Use Node's `fs/promises` for file reading
- Embedding dimension: `text-embedding-3-small` outputs 1536 dimensions. Pass to `createIndex`.
- Use `tsx` to run via `npm run ingest`

**Sketch**:

```typescript
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { embedMany } from 'ai';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { PgVector } from '@mastra/pg';
import { MDocument } from '@mastra/rag';

import { env } from '../src/lib/env';

const CORPUS_DIR = 'data/corpus';
const EMBEDDING_DIMENSION = 1536; // text-embedding-3-small

async function main() {
  console.log(`Ingesting corpus from ${CORPUS_DIR}...`);

  const files = (await readdir(CORPUS_DIR)).filter((f) => f.endsWith('.md'));
  if (files.length === 0) {
    throw new Error(`No markdown files found in ${CORPUS_DIR}`);
  }

  const store = new PgVector({
    id: 'pg-vector-ingest',
    connectionString: env.SUPABASE_DB_URL,
  });

  // Create index (idempotent if it already exists)
  try {
    await store.createIndex({
      indexName: env.RAG_INDEX_NAME,
      dimension: EMBEDDING_DIMENSION,
    });
    console.log(`Created index: ${env.RAG_INDEX_NAME}`);
  } catch (err) {
    // Index likely already exists — verify by attempting a query, otherwise rethrow
    if (!(err instanceof Error) || !/already exists/i.test(err.message)) {
      throw err;
    }
    console.log(`Index ${env.RAG_INDEX_NAME} already exists, skipping create`);
  }

  const embeddingModel = new ModelRouterEmbeddingModel(env.RAG_EMBEDDING_MODEL);

  let totalChunks = 0;
  for (const file of files) {
    const path = join(CORPUS_DIR, file);
    const content = await readFile(path, 'utf-8');
    const doc = MDocument.fromMarkdown(content);

    const chunks = await doc.chunk({
      strategy: 'markdown',
      maxSize: env.RAG_CHUNK_SIZE,
      overlap: env.RAG_CHUNK_OVERLAP,
    });

    console.log(`  ${file}: ${chunks.length} chunks`);

    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: chunks.map((c) => c.text),
    });

    const ids = chunks.map((_, i) =>
      createHash('sha256').update(`${file}:${i}`).digest('hex').slice(0, 32),
    );

    await store.upsert({
      indexName: env.RAG_INDEX_NAME,
      vectors: embeddings,
      metadata: chunks.map((c, i) => ({
        text: c.text,
        source: file,
        chunkIndex: i,
      })),
      ids,
    });

    totalChunks += chunks.length;
  }

  console.log(`\nIngestion complete: ${totalChunks} chunks across ${files.length} files`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
```

**Acceptance criteria**:
- `npm run ingest` exits 0 on a clean Postgres
- Re-running `npm run ingest` exits 0 (idempotent — no duplicate vectors)
- After running, `SELECT count(*) FROM mastra_docs` (or whatever the index name is) returns > 0
- Logs show progress per file
- Failure produces a useful error message and exit 1

---

## `scripts/eval.ts` (extended from base)

**Purpose**: Same as base — offline CI gate runner. Schema differs because RAG dataset uses `expectedSourceFile`/`expectedKeywords`/`expectedRefusal` instead of `expectedFields`.

**Implementation guidance**:
- Start from base's `scripts/eval.ts` as a reference
- Update the dataset case-handling logic to assert against the new schema
- For `expectedSourceFile`: check that the agent's response contains a citation `[source: <file>]` matching the expected file
- For `expectedKeywords`: case-insensitive substring check on the response text
- For `expectedRefusal`: check the response indicates inability to answer (look for phrases like "I don't have", "outside the documentation", "cannot answer from")
- Same AIMock pattern as base: when `USE_AIMOCK=true`, skip scorer assertions, only check field/keyword assertions

**Acceptance criteria**:
- `npm run eval` exits 0 with real OpenAI key + ingested corpus
- Each case prints case name, scorer scores, pass/fail, and which assertions failed
- Exit 1 with clear reasons when any assertion or scorer threshold fails
- Works under AIMock with field/keyword checks only

---

## `src/mastra/index.ts` (extended from base)

**Purpose**: Same as base, with `vectors` config added.

**Implementation**: Use the boot order from `02-architecture.md`. The two changes from base:

1. Add `import { PgVector } from '@mastra/pg';` (already imports `PostgresStore` from there)
2. Add the `vectors` field to the Mastra constructor config:

```typescript
vectors: {
  pgVector: new PgVector({
    id: 'pg-vector',
    connectionString: env.SUPABASE_DB_URL,
  }),
},
```

3. Replace the agent and scorer imports with the RAG versions

Everything else (storage, logger, observability) is unchanged.

**Acceptance criteria**:
- `npm run dev` boots Studio without errors
- `mastra.getVector('pgVector')` returns the PgVector instance
- The KB agent appears in Studio's agent list

---

## `package.json` updates

Scripts to add/modify:

```json
{
  "scripts": {
    "dev": "mastra dev",
    "build": "mastra build",
    "start": "mastra start",
    "typecheck": "tsc --noEmit",
    "ingest": "tsx scripts/ingest.ts",
    "eval": "tsx scripts/eval.ts",
    "score:list": "mastra scorers list"
  }
}
```

Add to dependencies:

```json
"@mastra/rag": "<latest>"
```

Run `npm install @mastra/rag` and let npm resolve the version.

---

## `.github/workflows/ci.yml` (extended from base)

**Purpose**: Same as base, with one addition.

**What to add**: A pre-eval step that runs `npm run ingest` against a local Postgres in CI before the eval gate runs. Without this, eval will fail because the index is empty.

**Implementation guidance**:

The eval job in base CI already has stub Supabase env vars. For RAG eval to work, those stubs need to point at a real Postgres instance running in the CI runner. Options:

1. **Postgres service container** in the eval job, plus a `Run pgvector migration` step + `npm run ingest` step before `npm run eval`. Adds ~2 min to CI runtime.
2. **Skip ingest in CI**, document that RAG eval is a local-only check. Loses the safety net.
3. **Use AIMock for embeddings AND the agent**, ingest mock vectors. Complex; deferred.

**Recommendation: option 1.** Add a `services` block for `postgres:16` with the pgvector image (`pgvector/pgvector:pg16`), update env vars to point at it, run the migration, run ingest, then run eval. Sample workflow snippet:

```yaml
eval:
  runs-on: ubuntu-latest
  needs: typecheck
  services:
    postgres:
      image: pgvector/pgvector:pg16
      env:
        POSTGRES_PASSWORD: postgres
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
    aimock:
      # ... existing aimock config
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'
    - run: npm ci
    - name: Apply pgvector migration
      run: psql "postgres://postgres:postgres@localhost:5432/postgres" -f supabase/migrations/0001_pgvector.sql
    - name: Ingest corpus
      run: npm run ingest
      env:
        SUPABASE_DB_URL: postgres://postgres:postgres@localhost:5432/postgres
        # ... other env stubs as in base
    - name: Run eval gate
      run: npm run eval
      env:
        USE_AIMOCK: 'true'
        # ... rest of env block from base
        SUPABASE_DB_URL: postgres://postgres:postgres@localhost:5432/postgres
```

**Acceptance criteria** (verified post-publish):
- All four CI jobs green: typecheck, build, eval, docker
- Eval job runs ingest successfully and eval against AIMock

---

## `prompts/build-rag-agent.md`

**Purpose**: Parameterized prompt for adding new RAG agents to a forked project. Same pattern as base's `build-agent.md`.

**Sections**:
- Inputs: agent name, corpus, system prompt focus, etc.
- Conventions: file locations, retrieval tool import, scorer registration
- Constraints: same as base's
- Implementation order

**Implementation**: Take base's `prompts/build-agent.md` as a template, adapt for RAG-specific needs:

- Add a "Corpus" input — what data the agent answers about
- Add a "Retrieval strategy" input — basic / filtered / hybrid (for now, only basic is in scope)
- Mention the `retrieve` tool import path
- Reference the RAG scorer triplet (faithfulness, answer relevancy, context relevance)

Don't write the full prompt verbatim here — adapt from base. Keep it under 200 lines.

**Acceptance criteria**:
- File exists in prompts/
- Mentions all RAG-specific conventions
- Owner can paste it into Claude Code to scaffold a new RAG agent

---

## `prompts/README.md`, `README.md`, `AGENTS.md`

These are documentation files. Adapt from base's versions:

- **README.md** — Rewrite for RAG focus. Add a "Pre-flight: ingest the corpus" step in quickstart. Add "How to swap the corpus" section. Add troubleshooting for common pgvector issues (extension not enabled, dimension mismatch).
- **AGENTS.md** — Inherit base's conventions. Add a "RAG conventions" section: always use the `retrieve` tool (don't reimplement retrieval), always cite sources, never answer from training data when the corpus is the source of truth.
- **prompts/README.md** — Add `build-rag-agent.md` to the index.

**Acceptance criteria**:
- Owner can run quickstart end-to-end (clone → install → migrate → ingest → dev) from README alone
- A contractor reading AGENTS.md understands the project's RAG philosophy
- prompts/README.md lists the new prompt
