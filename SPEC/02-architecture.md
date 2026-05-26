# 02 — Architecture

## Final file layout

```
template-mastra-rag/
├── .env.example                          # Inherits base + adds POSTGRES_CONNECTION_STRING (alias for vector access)
├── .dockerignore                         # Inherited from base
├── .github/workflows/ci.yml              # Extended with `npm run ingest` smoke job
├── AGENTS.md                             # Inherits base conventions + RAG-specific
├── CLAUDE.md                             # As in base
├── Dockerfile                            # Inherited from base, unchanged
├── README.md                             # Rewritten for RAG template
├── compose.dev.yml                       # Inherited from base
├── docker-compose.yml                    # Inherited from base
├── data/
│   └── corpus/                           # Frozen markdown corpus (4 Mastra RAG doc files)
│       ├── overview.md                   # RAG overview
│       ├── chunking-and-embedding.md
│       ├── vector-databases.md
│       └── retrieval.md
├── package.json                          # Adds @mastra/rag dep + ingest script
├── prompts/
│   ├── README.md                         # Updated index
│   ├── build-agent.md                    # From base
│   └── build-rag-agent.md                # NEW — parameterized prompt for RAG agents
├── scripts/
│   ├── eval.ts                           # Inherited from base, dataset path updated
│   └── ingest.ts                         # NEW — chunks corpus, embeds, upserts to pgvector
├── src/
│   ├── lib/
│   │   └── env.ts                        # Extended (no breaking changes)
│   └── mastra/
│       ├── agents/
│       │   └── _example.ts               # REPLACED — knowledge-base agent
│       ├── index.ts                      # Extended — registers PgVector under `vectors`
│       ├── lib/
│       │   ├── aimock.ts                 # From base, unchanged
│       │   ├── memory.ts                 # createDefaultMemory() — working memory baseline
│       │   ├── processors.ts             # Shared default input/output processors
│       │   └── supabase.ts               # From base, unchanged
│       ├── scorers/
│       │   ├── _example.scorers.ts       # REPLACED — RAG-specific scorers
│       │   └── datasets/
│       │       └── _example.json         # REPLACED — RAG eval dataset
│       ├── tools/
│       │   └── retrieve.ts               # NEW — retrieval tool wrapping createVectorQueryTool
│       └── workflows/                    # Empty
├── supabase/
│   └── migrations/
│       └── 0001_pgvector.sql             # NEW — enables pgvector extension
└── tsconfig.json                         # Inherited from base
```

## Files to delete from base

These are base's lead-intake assets, replaced by RAG equivalents:

- `src/mastra/agents/_example.ts` (lead-intake agent → knowledge-base agent)
- `src/mastra/scorers/_example.scorers.ts` (lead-intake scorers → RAG scorers)
- `src/mastra/scorers/datasets/_example.json` (lead-intake dataset → RAG dataset)

## Final dependency list

### Inherited from base
- `@mastra/core`
- `@mastra/duckdb`
- `@mastra/evals`
- `@mastra/loggers`
- `@mastra/memory`
- `@mastra/observability`
- `@mastra/pg`
- `@supabase/supabase-js`
- `@ai-sdk/openai`
- `zod`
- (devDeps) `tsx`, `typescript`, `mastra`, `@types/node`

### To add (production)
- `@mastra/rag` — provides `MDocument`, `createVectorQueryTool`, etc.

### To add (dev)
- None — corpus ingestion uses `tsx` (already a devDep)

### NOT to install
- Anything for re-ranking (deferred)
- Anything for GraphRAG (deferred)
- Direct `pgvector` Node clients — `@mastra/pg`'s PgVector class wraps everything

## Final env vars (additions on top of base)

### Required to boot

Same as base (no new required vars). `SUPABASE_DB_URL` is reused by `PgVector`.

### Optional (RAG-specific)

- `RAG_INDEX_NAME` — name of the pgvector index (default: `mastra_docs`)
- `RAG_TOP_K` — default number of chunks to retrieve per query (default: `5`)
- `RAG_EMBEDDING_MODEL` — embedding model identifier (default: `openai/text-embedding-3-small`)
- `RAG_CHUNK_SIZE` — max tokens per chunk (default: `512`)
- `RAG_CHUNK_OVERLAP` — token overlap between chunks (default: `50`)

These have sensible defaults, so the env loader treats them all as optional with `.default()`. Clients tweak them per project as needed.

## Component map

| Component | File | Job |
|---|---|---|
| Pgvector migration | `supabase/migrations/0001_pgvector.sql` | Enables `vector` extension in the project's Postgres DB |
| Vector store init | `src/mastra/index.ts` | Registers a `PgVector` instance under Mastra's `vectors` config |
| Corpus | `data/corpus/*.md` | The 4 Mastra RAG doc pages, frozen as static files |
| Ingestion script | `scripts/ingest.ts` | Reads corpus, chunks via `MDocument.fromMarkdown`, embeds via `embedMany`, upserts to `PgVector` |
| Retrieval tool | `src/mastra/tools/retrieve.ts` | Wraps `createVectorQueryTool` with the project's index/embedding config |
| Memory baseline | `src/mastra/lib/memory.ts` | `createDefaultMemory()` factory: working memory ON (resource-scoped), semantic recall OFF |
| Processor baseline | `src/mastra/lib/processors.ts` | `defaultInputProcessors` (UnicodeNormalizer) + `defaultOutputProcessors` (TokenLimiter, 8000-cap); model-backed safety processors present-but-commented (opt-in) |
| KB agent | `src/mastra/agents/_example.ts` | Production knowledge-base agent. Uses retrieve tool + `createDefaultMemory()` + the shared processors. Cites sources. |
| RAG scorers | `src/mastra/scorers/_example.scorers.ts` | Faithfulness, answer relevancy, context relevance |
| Eval dataset | `src/mastra/scorers/datasets/_example.json` | Canonical Q&A pairs about Mastra RAG with expected source files |

## Boot order in `src/mastra/index.ts`

Same strict order as base, with new vectors registration added:

```typescript
// 1. Env validation FIRST
import { env } from '../lib/env';

// 2. AIMock provider switch
import { configureAIMock } from './lib/aimock';
configureAIMock();

// 3. Mastra
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore, PgVector } from '@mastra/pg';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraCompositeStore } from '@mastra/core/storage';
import { Observability, DefaultExporter, SensitiveDataFilter } from '@mastra/observability';

import { knowledgeBaseAgent } from './agents/_example';
import { faithfulnessScorer, answerRelevancyScorer, contextRelevanceScorer } from './scorers/_example.scorers';

export const mastra = new Mastra({
  agents: { knowledgeBase: knowledgeBaseAgent },
  scorers: { faithfulnessScorer, answerRelevancyScorer, contextRelevanceScorer },
  vectors: {
    pgVector: new PgVector({
      id: 'pg-vector',
      connectionString: env.SUPABASE_DB_URL,
    }),
  },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new PostgresStore({
      id: 'mastra-storage',
      connectionString: env.SUPABASE_DB_URL,
    }),
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

The `vectors` field at the Mastra level makes the PgVector instance accessible to tools via `mastra.getVector('pgVector')`. The retrieval tool uses this name in its `vectorStoreName` parameter.
