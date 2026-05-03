# 01 — Context

## What this template is

`template-mastra-rag` is the RAG child template in Otaku Solutions' Mastra template family. It forks from `template-mastra-base` and adds:

- Pgvector enabled in Supabase (via migration)
- A frozen markdown corpus (Mastra's RAG documentation)
- Ingestion pipeline that chunks the corpus, embeds it, and writes to pgvector
- Retrieval tool that performs semantic search with source attribution
- Knowledge-base agent that answers questions about its corpus

## Relationship to base

| Layer | Source |
|---|---|
| Env loader (`src/lib/env.ts`) | Inherited from base, extended with new RAG vars |
| AIMock provider switch (`src/mastra/lib/aimock.ts`) | Inherited from base, unchanged |
| Supabase client factory (`src/mastra/lib/supabase.ts`) | Inherited from base, unchanged |
| Mastra entry (`src/mastra/index.ts`) | Inherited from base, extended with vectors registration |
| Composite store (Postgres + DuckDB) | Inherited from base, unchanged |
| Memory adapter | Inherited from base (PostgresStore) |
| Observability + scorers + Docker + CI | Inherited from base |
| Lead-intake agent | **Removed** — replaced by knowledge-base agent |
| Lead-intake scorers | **Removed** — replaced by RAG-specific scorers |
| Pgvector | **New** |
| Corpus + ingestion | **New** |
| Retrieval tool | **New** |
| Knowledge-base agent | **New** |

## Scope decisions (do not relitigate)

| Decision | Choice | Why |
|---|---|---|
| Vector store | `@mastra/pg` PgVector against Supabase Postgres | Already required by base for memory; same DB for vectors keeps deployment simple |
| Embedding model | `openai/text-embedding-3-small` (1536 dims) | Mastra's recommended default; small enough to be cheap, large enough to be accurate |
| Chunking strategy | `markdown` strategy from `MDocument`, maxSize 512, overlap 50 | The corpus IS markdown; preserves header/list structure |
| Corpus | Mastra's own RAG documentation — 4 markdown files | Provided by owner in conversation; production-quality content the agent can actually answer questions about |
| Corpus storage | Static markdown in `data/corpus/`, frozen at template-creation time | No refresh logic; owner re-snapshots on template version bumps |
| Retrieval pattern | `createVectorQueryTool` from `@mastra/rag` | Mastra's first-party tool; agent decides when to retrieve |
| KB agent default model | `openai/gpt-5-mini` (or current best small OpenAI model) | OpenAI for AIMock compatibility; small model because retrieval does heavy lifting |
| Re-ranking | **Not in scope** for v1 — can be added later | Adds complexity (cross-encoder model, more API calls); start simple |
| GraphRAG | **Not in scope** for v1 | Same reason; flat retrieval is sufficient for the demo corpus |
| Scorers for KB agent | `createFaithfulnessScorer` (LLM judge), `createAnswerRelevancyScorer` (LLM judge), `createContextRelevanceScorer` (LLM judge) | Standard RAG eval triplet from `@mastra/evals/scorers/prebuilt` |
| Ingestion as workflow vs script | Script (`scripts/ingest.ts`) | One-shot operation, doesn't need workflow primitives |
| Index name in pgvector | `mastra_docs` | Single index; clients can rename or add more for their corpora |

## Quality bar

Same as base, plus:

- **Corpus successfully ingests** — running `npm run ingest` chunks, embeds, and upserts every markdown file in `data/corpus/` without errors. The pgvector index is populated.
- **KB agent answers correctly** — given canonical questions about Mastra RAG, the agent retrieves relevant chunks and produces accurate, source-cited answers.
- **Eval gate passes** — RAG scorers (faithfulness, answer relevancy, context relevance) clear thresholds when run against the canonical question set.
- **Live smoke test** — chatting with the KB agent in Studio returns useful answers with source citations visible in the trace.

## What this template ships with that clients keep

- The pgvector setup (always useful)
- The ingestion pipeline (clients adapt for their own corpora)
- The retrieval tool (drop-in for any RAG agent)
- The KB agent **as a working production tool** — answers Mastra questions, useful during development. Clients may keep it as-is for internal dev use, or replace its corpus with client-specific docs.

## What this template does NOT include

- Re-ranking (deferred to v2)
- GraphRAG (deferred to v2)
- Multiple vector indices (clients add more as needed)
- Document upload UI (deferred — not all clients need this)
- Webhook/API for runtime ingestion (deferred — most clients ingest via cron or manual runs)
- Multi-tenant isolation patterns (deferred — depends on client requirements)
