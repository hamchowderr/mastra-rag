# template-mastra-rag

A production-ready Mastra RAG starter. One knowledge-base agent backed by pgvector, a full eval pipeline (faithfulness, answer relevancy, context relevance), Docker, and CI — everything you need to ship a RAG agent without building the scaffold yourself.

---

## Quickstart (10 minutes)

**Prerequisites**: Node 22+, Docker Desktop, a Supabase project, an OpenAI API key.

```bash
# 1. Clone and install
git clone <repo> my-rag && cd my-rag
npm install

# 2. Configure environment
cp .env.example .env
# Fill in: APP_SECRET, SUPABASE_*, OPENAI_API_KEY

# 3. Start local Supabase (first time only)
npx supabase start

# 4. Enable pgvector (first time only)
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_pgvector.sql

# 5. Ingest the corpus
npm run ingest

# 6. Run
npm run dev
# → Mastra Studio at http://localhost:4111
```

Chat with the `knowledgeBase` agent in Studio to verify everything works. Send:

> What chunking strategies does Mastra support?

Expected: a grounded answer citing `chunking-and-embedding.md` with no hallucination.

---

## Reachability

This template's agents are reachable through four standard protocols. Once the dev server is running (`npm run dev`), every registered agent can be called via:

### REST API

Direct HTTP calls. The fastest path for n8n, Make, VAPI, LiveKit, or any HTTP-aware system.

```bash
curl -X POST http://localhost:4111/api/agents/knowledgeBase/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What chunking strategies does Mastra support?"}]}'
```

For streaming responses, use `/stream` instead of `/generate`. Full OpenAPI spec at `/api/openapi.json`. Interactive docs at `/swagger-ui` (dev only).

### A2A (Agent-to-Agent Protocol)

Google's open standard for agent-to-agent communication. JSON-RPC over HTTP.

```bash
# Get agent card
curl http://localhost:4111/api/.well-known/knowledgeBase/agent-card.json

# Send a message (JSON-RPC)
curl -X POST http://localhost:4111/api/a2a/knowledgeBase \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":"1","method":"message/send","params":{"message":{"kind":"message","messageId":"msg-1","role":"user","parts":[{"kind":"text","text":"What is RAG?"}]}}}'
```

Use this when another agent (in CrewAI, LangGraph, ADK, or any A2A-compatible framework) needs to delegate work to this template's agent.

### MCP (Model Context Protocol)

Anthropic's open standard for agent-tool integration. The template's MCPServer exposes every agent as a callable tool at `/api/mcp/rag-mcp/mcp`.

To use from Claude Desktop, add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "template-mastra-rag": {
      "url": "http://localhost:4111/api/mcp/rag-mcp/mcp"
    }
  }
}
```

Each agent appears as a tool named `ask_<agentId>`. Useful during development (call your own agent from your IDE) and for cross-system integration.

### Studio (visual UI + Editor)

Open `http://localhost:4111` in a browser. Studio provides:

- Interactive chat with each agent
- Trace inspection for every run
- Metrics dashboard (cost, latency, errors)
- **Agent Editor**: Non-developers iterate on agent instructions, prompts, and tools without touching code. Changes are versioned with draft/publish workflow.

The Editor is intended for product teams, prompt engineers, or subject-matter experts to tune behavior between deploys. Code-defined agents have read-only `id`, `name`, and `model` fields; everything else is editable through Studio.

For production deployment, secure Studio behind authentication. See [Mastra's auth docs](https://mastra.ai/docs/server/auth/overview).

---

## How to Swap the Corpus

1. Replace the files in `data/corpus/` with your own markdown documents
2. Update `scripts/ingest.ts` if your source format differs (the script uses `MDocument.fromMarkdown`)
3. Re-run `npm run ingest` — it drops and recreates the `mastra_docs` index
4. Update `src/mastra/agents/_example.ts` `instructions` to describe the new corpus subject
5. Update `src/mastra/scorers/datasets/_example.json` eval cases to match the new content

> The agent's system prompt already instructs it to refuse out-of-corpus questions. You only need to update the instructions preamble describing *what* the corpus is about.

---

## File Structure

```
template-mastra-rag/
├── src/
│   ├── lib/
│   │   └── env.ts                  # Zod-validated env loader — crashes on bad config
│   └── mastra/
│       ├── index.ts                # Entry point: env → AIMock → Mastra instance
│       ├── agents/
│       │   └── _example.ts         # knowledgeBase agent — copy this for new RAG agents
│       ├── lib/
│       │   ├── aimock.ts           # Routes LLM calls to AIMock when USE_AIMOCK=true
│       │   └── supabase.ts         # Supabase client factory
│       ├── scorers/
│       │   ├── _example.scorers.ts # faithfulness + answerRelevancy + contextRelevance
│       │   └── datasets/
│       │       └── _example.json   # Eval dataset — 5 cases with thresholds
│       └── tools/
│           └── retrieve.ts         # createVectorQueryTool wrapping the pgVector index
├── data/
│   └── corpus/                     # Source markdown files for ingestion
│       ├── overview.md
│       ├── chunking-and-embedding.md
│       ├── vector-databases.md
│       └── retrieval.md
├── scripts/
│   ├── ingest.ts                   # Chunk → embed → upsert to pgVector
│   └── eval.ts                     # Offline CI eval gate — exits 0/1 based on thresholds
├── supabase/
│   └── migrations/
│       └── 0001_pgvector.sql       # CREATE EXTENSION IF NOT EXISTS vector
├── prompts/
│   ├── README.md                   # Index of agent-building prompts
│   ├── build-agent.md              # Parameterized prompt: add a new Mastra agent
│   └── build-rag-agent.md          # Parameterized prompt: add a new RAG agent
├── .github/
│   └── workflows/
│       └── ci.yml                  # typecheck → build + eval (parallel) → docker
├── Dockerfile                      # Multi-stage, node:22-slim runtime
├── docker-compose.yml              # Production compose
├── compose.dev.yml                 # Dev compose override
├── .env.example                    # All required env vars with comments
└── AGENTS.md                       # Conventions for AI coding agents
```

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start Mastra Studio at localhost:4111 |
| `npm run build` | Bundle for production (output → `.mastra/output/`) |
| `npm run start` | Start production server (no Studio) |
| `npm run ingest` | Chunk, embed, and upsert `data/corpus/` into pgVector |
| `npm run eval` | Run offline eval gate against all cases in the dataset |
| `npm run typecheck` | TypeScript type check (zero-emit) |

---

## Adding a New RAG Agent

1. Copy `src/mastra/agents/_example.ts` → `src/mastra/agents/my-agent.ts`
2. Update `id`, `name`, `instructions` (describe what corpus the agent covers)
3. The `retrieve` tool is shared — import it directly from `../tools/retrieve`
4. Register in `src/mastra/index.ts` under `agents:`
5. Add eval cases to a new dataset file in `src/mastra/scorers/datasets/`
6. Use `prompts/build-rag-agent.md` with Claude Code to generate a complete RAG agent from a description

---

## Running Evals

```bash
# Against live OpenAI API (incurs cost)
npm run eval

# Against AIMock (deterministic, no API cost)
# Assertion checks run; scorer LLM calls are skipped under AIMock
USE_AIMOCK=true npm run eval

# Custom dataset
node --env-file=.env --import tsx/esm scripts/eval.ts path/to/dataset.json
```

---

## Docker

```bash
# Build
docker build -t my-rag:latest .

# Run
docker compose up -d

# Health check
curl http://localhost:4111/health
```

> **Local Supabase note**: Docker containers can't reach `127.0.0.1` on the host. Set `SUPABASE_DB_URL` to use `host.docker.internal` and pass `--add-host=host.docker.internal:host-gateway` (Linux) or use Docker Desktop (Mac/Windows, automatic).

---

## Deployment Notes

### Non-Supabase Postgres

If you're deploying against bare Postgres (DigitalOcean Managed Postgres, RDS, etc.), run the migration manually before starting the service:

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_pgvector.sql
```

The migration is idempotent (`IF NOT EXISTS`) — safe to run on every deploy.

### Docker image size

The production image is ~676MB. This is larger than typical Node.js Docker images because:

- The base is `node:22-slim` (Debian, glibc) instead of `node:22-alpine` (musl)
- DuckDB ships native binaries that segfault on musl libc
- DuckDB is required by `@mastra/observability` for trace storage

If you need a smaller image, swap `DuckDBStore` for `LibSQLStore` in the observability domain in `src/mastra/index.ts`. Trade-off: slower trace queries in Mastra Studio under load.

---

## Common Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `Invalid environment variables` on boot | Missing or malformed `.env` | Check each var listed in the error against `.env.example` |
| `ECONNREFUSED 127.0.0.1:54322` | Local Supabase not running | `npx supabase start` |
| `extension "vector" does not exist` | pgvector migration not applied | `psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_pgvector.sql` |
| `dimension mismatch` on query | Index was created with a different model | `npm run ingest` after changing `RAG_EMBEDDING_MODEL` |
| `SELECT COUNT(*) FROM mastra_docs` returns 0 | Ingest not run yet | `npm run ingest` |
| Docker container crashes (SIGSEGV) | DuckDB requires glibc, not musl | Use `node:22-slim`, not `node:22-alpine` |
| `ECONNREFUSED` inside Docker | `127.0.0.1` in DB URL | Replace with `host.docker.internal` |
| Agent not listed in Studio | Not registered in `mastra.agents` | Add to `src/mastra/index.ts` |
| PostHog telemetry noise | Mastra runtime phones home on startup | Set `MASTRA_TELEMETRY_DISABLED=1` in `.env` |
| DB connection errors at scale | Direct Supabase connection has limited slots | Use the session pooler URL from Supabase dashboard |

---

## Environment Variables

See `.env.example` for the full list with comments. Minimum required:

- `APP_SECRET` — min 32 chars, generate with `openssl rand -hex 32`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`
- `OPENAI_API_KEY` — required for embedding (ingest + retrieval use `text-embedding-3-small`)

RAG-specific vars (all optional, have defaults):

- `RAG_INDEX_NAME` — pgVector index name (default: `mastra_docs`)
- `RAG_EMBEDDING_MODEL` — embedding model ID (default: `text-embedding-3-small`)
- `RAG_EMBEDDING_DIMENSIONS` — vector dimensions (default: `1536`)
- `RAG_CHUNK_SIZE` — characters per chunk (default: `1000`)
- `RAG_CHUNK_OVERLAP` — overlap between chunks (default: `200`)

---

## For AI Coding Agents

See `AGENTS.md` for conventions, boot order, import rules, RAG conventions, and things to never do.
