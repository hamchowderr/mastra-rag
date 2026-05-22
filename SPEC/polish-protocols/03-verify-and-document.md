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

### A2A endpoints

The A2A protocol exposes two distinct endpoints per agent:

```bash
# Agent card (GET)
curl http://localhost:4111/api/.well-known/knowledgeBase/agent-card.json

# Send a message (POST, JSON-RPC)
curl -X POST http://localhost:4111/api/a2a/knowledgeBase \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":"1","method":"message/send","params":{"message":{"kind":"message","messageId":"msg-1","role":"user","parts":[{"kind":"text","text":"What chunking strategies does Mastra support?"}]}}}'
```

**Pass**: agent card returns 200 with JSON metadata; JSON-RPC call returns 200 with task result.

The path `/a2a/{agentId}` (without `/api/` prefix) returns Studio HTML — that's a Studio catch-all, not the A2A endpoint. Use the paths above.

### MCP endpoint
```bash
curl -X POST http://localhost:4111/api/mcp/rag-mcp/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

**Pass**: HTTP 200, JSON-RPC response with server info `{"name":"template-mastra-rag","version":"0.1.0"}`. Note the URL uses `rag-mcp` (the MCPServer `id`), not `ragMcp` (the mcpServers config key). The MCP protocol requires both the `Accept` header and an initial `initialize` call before `tools/list` will succeed.

After initialization, list tools:
```bash
curl -X POST http://localhost:4111/api/mcp/rag-mcp/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}'
```

**Pass**: response lists `ask_knowledgeBase` as one of the tools.

### Studio + Editor + retrieval regression check

- Studio loads
- knowledgeBase agent visible
- Editor tab present
- Chat: ask "How do I filter retrieval results by metadata?" — agent should call retrieve tool, return chunks, cite `retrieval.md`

If retrieval breaks, the polish has interfered with vectors. STOP and report.

## Step 2: Document in README

Add a "Reachability" section after the Quickstart, matching the canonical pattern from the corrected base template. Adapt agent name and MCP id for RAG.

```markdown
## Reachability

Once the dev server is running (`npm run dev`) and the corpus is ingested (`npm run ingest`), the `knowledgeBase` agent is reachable through four standard paths.

**Pre-flight**: Run `npm run ingest` once to populate the pgvector index before any of the paths below will return useful results. Without ingestion, the agent will refuse to answer (anti-hallucination behavior — see eval gate).

### REST API

\`\`\`bash
curl -X POST http://localhost:4111/api/agents/knowledgeBase/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What chunking strategies does Mastra support?"}]}'
\`\`\`

For streaming responses, use `/stream` instead of `/generate`.

### A2A (Agent-to-Agent Protocol)

\`\`\`bash
# Get agent card
curl http://localhost:4111/api/.well-known/knowledgeBase/agent-card.json

# Send a message (JSON-RPC)
curl -X POST http://localhost:4111/api/a2a/knowledgeBase \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":"1","method":"message/send","params":{"message":{"kind":"message","messageId":"msg-1","role":"user","parts":[{"kind":"text","text":"What chunking strategies does Mastra support?"}]}}}'
\`\`\`

### MCP (Model Context Protocol)

Add to `claude_desktop_config.json`:

\`\`\`json
{
  "mcpServers": {
    "template-mastra-rag": {
      "url": "http://localhost:4111/api/mcp/rag-mcp/mcp"
    }
  }
}
\`\`\`

The agent appears as a tool named `ask_knowledgeBase`. Note the URL uses the MCPServer `id` field (`rag-mcp`), not the config key in `src/mastra/index.ts` (`ragMcp`).

### Studio (visual UI + Editor)

Open `http://localhost:4111`. Studio provides interactive chat, trace inspection, metrics, and the Agent Editor for non-developers to tune instructions without touching code.
```

## Step 3: Update AGENTS.md

Add a "Reachability conventions" section. Use the canonical text from `template-mastra-base/AGENTS.md` after its base polish. RAG-specific addition:

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
  - A2A card (/api/.well-known/knowledgeBase/agent-card.json): <pass | fail>
  - A2A execute (POST /api/a2a/knowledgeBase): <pass | fail>
  - MCP (/api/mcp/rag-mcp/mcp): <pass | fail>
  - Studio + Editor: <pass | fail>
  - Retrieval regression check: <pass | fail>
- README updated with "Reachability" section + ingestion pre-flight note
- AGENTS.md updated with conventions + RAG specifics
- Notes: <anything unexpected, especially around vectors integration>
```

Move on to Polish 04.
