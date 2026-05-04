# RAG Polish 03 — Verify Reachability + Document

## Step 1: Verify all four endpoints

With `npm run dev` running and the corpus already ingested (`npm run ingest`):

### REST endpoint
```bash
curl -X POST http://localhost:4111/api/agents/knowledgeBase/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What chunking strategies does Mastra support?"}]}'
```

**Pass**: HTTP 200, response includes content from the corpus with `[source: chunking-and-embedding.md]` citation.

### A2A endpoint
```bash
curl http://localhost:4111/a2a/knowledgeBase
```

**Pass**: HTTP 200 with agent card JSON.

### MCP endpoint
```bash
curl -X POST http://localhost:4111/api/mcp/ragMcp/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

**Pass**: HTTP 200, JSON-RPC response listing tools. The `ask_knowledgeBase` tool must be in the list.

### Studio + Editor + retrieval regression check

- Studio loads at localhost:4111
- knowledgeBase agent visible
- Editor tab present
- Chat: ask "How do I filter retrieval results by metadata?" — agent should call retrieve tool, return chunks, cite `retrieval.md`

If retrieval breaks, the polish has interfered with vectors. STOP and report.

## Step 2: Document in README

Add a "Reachability" section. Same structure as base/voice but with RAG-specific examples (knowledgeBase agent, ragMcp server key, mention the corpus and ingestion requirement).

Include this RAG-specific note:

```markdown
**Pre-flight for all integration paths**: Run `npm run ingest` once to populate the pgvector index before any of the above will return useful results. Without ingestion, the agent will refuse to answer (anti-hallucination behavior — see eval gate).
```

## Step 3: Update AGENTS.md

Same "Reachability conventions" section as base. Plus RAG-specific:

```markdown
## RAG template specifics

The template ships with a `vectors` field on the Mastra constructor (`pgVector: new PgVector(...)`). Do not remove or rename this — the retrieve tool depends on the `vectorStoreName: 'pgVector'` reference.

The `data/corpus/` directory is the frozen markdown corpus. To swap corpus content, replace files there and re-run `npm run ingest`.
```

## What to capture in PROGRESS.md

```
## RAG Polish 03: Verify + Document Reachability
- Status: complete
- Endpoints verified:
  - REST: <pass | fail>
  - A2A: <pass | fail>
  - MCP: <pass | fail>
  - Studio + Editor: <pass | fail>
  - Retrieval regression check: <pass | fail>
- README updated with "Reachability" section + ingestion pre-flight note
- AGENTS.md updated with conventions + RAG specifics
- Notes: <anything unexpected, especially around vectors integration>
```

Move on to Polish 04.
