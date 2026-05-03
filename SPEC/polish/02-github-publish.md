# RAG Polish 02 — GitHub Publish & CI Verification

Push the RAG template to GitHub, configure secrets, watch CI run green, tag v0.1.0.

This is the final gate. After this, the RAG template is provisioning-ready alongside base and voice.

## Prerequisites

- Polish 01 complete
- `gh` CLI installed and authenticated (`gh auth status`)
- A real `CI_APP_SECRET` value (generate with `openssl rand -hex 32`)
- A real `CI_OPENAI_API_KEY` (the RAG eval job uses real OpenAI for embeddings — see PROGRESS.md Phase 13 fix)
- The owner's GitHub username/org: `hamchowderr` (matches base + voice)

## Steps

### 1. Pre-flight: secrets check

Verify nothing sensitive is staged:

```bash
cd C:\Users\HamCh\code\template-mastra-rag
git status
```

**Pass criteria:**
- `.env` NOT in tracked files
- No file containing real API keys, Supabase service role keys, or OpenAI keys

If anything sensitive shows up:
1. Verify `.gitignore` includes `.env`, `node_modules/`, `.mastra/`, `mastra.duckdb*`, `.beads`
2. Run `git rm --cached <file>` for any sensitive file already tracked
3. Re-verify

### 2. Initialize git if needed

```bash
git log --oneline | head -3
```

If "fatal: not a git repository" or no commits:

```bash
git init
git add .
git commit -m "Initial commit: template-mastra-rag from spec build"
```

If git is already initialized with uncommitted work from Polish 01:

```bash
git add .
git commit -m "Polish complete: ready for v0.1.0 publish"
```

### 3. Create the GitHub repo

```bash
gh repo create hamchowderr/template-mastra-rag \
  --public \
  --source=. \
  --description "RAG agent Mastra template — pgvector, document ingestion, retrieval tool, knowledge-base agent, forks from template-mastra-base" \
  --push
```

**Pass criteria:**
- Command exits 0
- Repo URL printed
- `git remote -v` shows the new origin

### 4. Configure GitHub secrets

Two secrets needed for this template's CI:

```bash
# Secret 1: APP_SECRET for the build job
openssl rand -hex 32
# Copy the output, then:
gh secret set CI_APP_SECRET --repo hamchowderr/template-mastra-rag
# Paste when prompted

# Secret 2: OpenAI API key for the eval job's ingest step
# Use the owner's existing OpenAI key (from Infisical) — same one used in local eval
gh secret set CI_OPENAI_API_KEY --repo hamchowderr/template-mastra-rag
# Paste the OpenAI API key when prompted
```

**Pass criteria:**
- `gh secret list --repo hamchowderr/template-mastra-rag` shows both `CI_APP_SECRET` and `CI_OPENAI_API_KEY`

**Cost note**: The eval job will run real OpenAI calls (embeddings + LLM judges). Per CI run cost: ~$0.20. Acceptable for the value of full eval coverage.

### 5. Trigger CI

The push from step 3 should have triggered CI. Check:

```bash
gh run list --repo hamchowderr/template-mastra-rag --limit 3
```

If no run appeared:

```bash
gh workflow run ci.yml --repo hamchowderr/template-mastra-rag
```

### 6. Watch CI complete

```bash
gh run watch --repo hamchowderr/template-mastra-rag
```

**Pass criteria:**
- All four jobs report ✓:
  - `typecheck` ✓
  - `build` ✓
  - `eval` ✓ (this is the meaningful one — runs ingest + 5 cases against real OpenAI)
  - `docker` ✓ (only on push to main)
- Total CI duration: probably 8–15 minutes (eval + ingest are slower than other templates)

### 7. Investigate any failures

Common RAG-template-specific failures:

| Failure | Likely cause | Fix |
|---|---|---|
| `eval` red, "could not connect to postgres" | Postgres service container not ready | Bump health check retries in workflow's services block |
| `eval` red, "type vector does not exist" | pgvector extension not enabled on CI postgres | Verify the workflow uses `pgvector/pgvector:pg16` image, not `postgres:16` |
| `eval` red, ingest step times out | OpenAI rate limit on cold runner | Add `OPENAI_API_KEY` retry logic OR re-run CI |
| `eval` red, all scorer thresholds tank | Embedding dimension mismatch (e.g., index created with 1536 but model emits different) | Verify `RAG_EMBEDDING_MODEL` and ingest dimension constant agree |
| `build` red, missing `OPENAI_API_KEY` | env loader requires at least one LLM key but build job doesn't stub it | Add `OPENAI_API_KEY: stub` to build job env block |
| `docker` red, build context too large | data/corpus included is fine, but check if .mastra/, node_modules/, or mastra.duckdb leaked | Verify `.dockerignore` excludes them |

If something else fails, document in PROGRESS.md and stop. Don't push band-aid commits.

### 8. Tag v0.1.0

Once CI is green:

```bash
git tag -a v0.1.0 -m "v0.1.0 — RAG template, pgvector + Mastra docs corpus"
git push origin v0.1.0
```

### 9. Optional: provisioning smoke test

Verify the template is genuinely template-able:

```bash
mkdir C:\Users\HamCh\Downloads\rag-test
cd C:\Users\HamCh\Downloads\rag-test
npx degit hamchowderr/template-mastra-rag rag-client-test
cd rag-client-test
copy ..\..\code\template-mastra-rag\.env .env
# Edit APP_SECRET to a fresh value: openssl rand -hex 32
npm install
npm run typecheck
npm run dev
```

**Pass criteria:**
- All commands succeed
- Studio loads at localhost:4111
- `knowledgeBase` agent visible

If you also want to verify retrieval works in the smoke test:

```bash
# In another terminal:
npm run ingest
# Then in Studio, ask "How do I chunk markdown?" — should retrieve and answer
```

Clean up:
```bash
cd ..
rm -rf rag-client-test
```

This step is optional but recommended — it's the only way to confirm the GitHub repo actually works as a template.

---

## What to capture in PROGRESS.md

```
## RAG Polish 02: GitHub Publish & CI
- Status: complete | blocked
- Repo URL: https://github.com/hamchowderr/template-mastra-rag
- CI runs:
  - typecheck: ✓ <duration>
  - build: ✓ <duration>
  - eval: ✓ <duration>
  - docker: ✓ <duration>
- Tag: v0.1.0 pushed
- Provisioning smoke test: pass | skipped | fail
- Notes: <CI quirks, anything unexpected>
```

## Final wrap-up

After RAG Polish 02:

```markdown
## RAG Polish Complete

- Status: complete
- Both polish steps:
  - 01 Cleanup & package fix: pass
  - 02 GitHub publish: pass — repo at https://github.com/hamchowderr/template-mastra-rag, tag v0.1.0
- Outstanding issues: <if any>
- Recommended next action: ready for owner to revise NCA spec (factual errors flagged in conversation transcript)
```

## You're done

After this, RAG is published, polished, and provisioning-ready alongside base and voice. The template family is now 3 of 5 complete.
