# RAG Polish — Standard Reachability + Editor Configuration

Brings the RAG template up to the family's standard configuration.

Every template in this family ships with REST, A2A, MCP, Studio, and the Editor. These are not optional. This polish brings `template-mastra-rag` to standard at `https://github.com/hamchowderr/template-mastra-rag`.

## RAG-specific notes

The RAG template already has a `vectors` field in the Mastra constructor for the pgvector index. The polish adds `editor` and `mcpServers` fields alongside — the existing `vectors` config stays unchanged.

The `knowledgeBase` agent must have a `description` for MCPServer registration to succeed.

## Read these files in order

1. **`00-README.md`** (this file)
2. **`01-install-and-storage.md`**
3. **`02-register-editor-and-mcp.md`**
4. **`03-verify-and-document.md`**
5. **`04-push-to-main.md`**

## Operating mode

- Stop after each step, write to `SPEC/PROGRESS.md`, wait for "continue".
- No new git tag — main update only.
- Don't refactor working code (especially the corpus ingestion script and retrieve tool).
- Time budget: 60 minutes.

## Reporting

```
## RAG Polish — Standard Reachability + Editor Configuration
- Status: complete | blocked
- All 5 polish steps: <list with pass/fail>
- Packages installed: @mastra/editor, @mastra/mcp
- Files changed: src/mastra/index.ts, README.md, AGENTS.md, package.json
- vectors config: NOT MODIFIED (verified)
- Corpus + retrieve tool: NOT MODIFIED (verified)
- CI run: <status>
```
