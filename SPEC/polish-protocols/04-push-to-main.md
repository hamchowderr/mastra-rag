# RAG Polish 04 — Push to Main

## Step 1: Pre-flight

```bash
cd C:\Users\HamCh\code\template-mastra-rag
git status
```

Verify nothing sensitive is staged.

## Step 2: Commit

```bash
git add .
git commit -m "Configure standard reachability stack

Brings template up to family standard:
- @mastra/editor: non-developer agent iteration via Studio Editor
- @mastra/mcp: MCPServer exposing knowledgeBase agent
- editor storage domain in MastraCompositeStore
- README documents REST/A2A/MCP/Studio reachability
- AGENTS.md documents reachability conventions and RAG specifics
- vectors config preserved (RAG retrieval unaffected)"
```

## Step 3: Push to main

```bash
git push origin main
```

**No tag.**

## Step 4: Watch CI

```bash
& 'C:\Program Files\GitHub CLI\gh.exe' run watch --repo hamchowderr/template-mastra-rag
```

**Pass criteria**: All four CI jobs green (especially eval, which uses real OpenAI key).

RAG-specific failures:

| Failure | Likely cause | Fix |
|---|---|---|
| `eval` red, retrieval returning nothing | Polish accidentally disturbed `vectors` field | Re-check Polish 02 — `vectors: { pgVector: ... }` must be preserved exactly |
| `eval` red, faithfulness below threshold | Description change affected behavior | Unlikely but possible — re-check the description text |
| `build` red, ingest can't find corpus | `data/corpus/` got moved | RAG's data directory should be untouched |

## Step 5: Final wrap-up entry in PROGRESS.md

```markdown
## RAG Polish — Standard Reachability + Editor Configuration — COMPLETE

- Status: complete
- All 4 polish steps:
  - 01 Install Packages + Editor Storage: pass
  - 02 Configure MCPServer + MastraEditor: pass
  - 03 Verify + Document Reachability: pass
  - 04 Push to Main: pass
- Repo: https://github.com/hamchowderr/template-mastra-rag
- CI: green on main
- Packages installed: @mastra/editor, @mastra/mcp
- Files changed: package.json, package-lock.json, src/mastra/index.ts, README.md, AGENTS.md, src/mastra/agents/_example.ts (description if added)
- vectors config: NOT MODIFIED (verified)
- Corpus + ingest script: NOT MODIFIED (verified)
- Retrieval regression check: pass
- No new tag pushed
- Recommended next action: bake same protocols + editor pattern into NCA spec, then build NCA
```

Done. All three published templates now have the standard reachability stack configured.
