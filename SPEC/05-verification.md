# 05 — Verification

End-to-end test plan. Run after the build is complete. Each step has a clear pass/fail criterion. Document failures in `PROGRESS.md`.

## Setup

- A real Supabase project (or local Supabase via `npx supabase start`) with pgvector enabled
- A real OpenAI API key (default model is OpenAI for AIMock compatibility)
- Docker installed (for Phase 10 verification)
- The corpus already ingested (Phase 5 completed)

Create a working `.env`:

```bash
cp .env.example .env
# Fill in the SUPABASE_*, OPENAI_API_KEY, APP_SECRET, MASTRA_TELEMETRY_DISABLED=1
```

## Tests in order

### 1. Typecheck

```bash
npm run typecheck
```

**Pass**: zero errors.

### 2. Pgvector extension is enabled

```bash
psql "$SUPABASE_DB_URL" -c "SELECT * FROM pg_extension WHERE extname='vector'"
```

**Pass**: returns one row.

### 3. Corpus is ingested

```bash
psql "$SUPABASE_DB_URL" -c "SELECT count(*) FROM mastra_docs"
```

**Pass**: count > 30 (4 files × ~8 chunks each, conservatively).

### 4. Dev boot

```bash
npm run dev
```

**Pass**:
- Studio loads at `http://localhost:4111`
- `knowledgeBase` agent appears in agent list
- No errors in console

### 5. Live agent smoke test (Studio)

In Studio, chat with `knowledgeBase`. Paste:

> What chunking strategies does Mastra support for documents?

**Pass**:
- Agent responds within ~10 seconds
- Response mentions multiple strategies (recursive, markdown, sentence, etc.)
- Response includes `[source: chunking-and-embedding.md]` citation
- Trace shows the `retrieve` tool was invoked with the user's query
- Trace shows ~5 chunks were returned from the vector store

**Cost**: ~$0.02

### 6. Live agent smoke test (multi-turn)

Send a follow-up:

> Can you show me an example of using the markdown strategy?

**Pass**:
- Agent uses memory (knows we're talking about chunking)
- Calls retrieve again with refined query
- Returns a code example pulled from the corpus, not paraphrased
- Includes source citation

### 7. Anti-hallucination test

In a new thread (or just send):

> What's the capital of France?

**Pass**:
- Agent does NOT answer "Paris"
- Agent says it can't answer from the documentation, or asks how this relates to Mastra
- This is the canonical anti-hallucination behavior — agent stays grounded in its corpus

**Cost**: ~$0.01

### 8. cURL test

```bash
curl -X POST http://localhost:4111/api/agents/knowledgeBase/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"How do I filter retrieval results by metadata?"}]}'
```

**Pass**:
- HTTP 200
- Response body mentions filtering, `$or`, `$gt`, etc.
- Source citation `[source: retrieval.md]`

### 9. Health endpoint

```bash
curl http://localhost:4111/health
```

**Pass**: HTTP 200.

### 10. Eval gate (live)

```bash
npm run eval
```

**Pass**:
- All 5 cases run
- Each case prints scores for all three scorers + assertion results
- All scorers ≥ thresholds
- Exit 0

**Cost**: ~$0.20 (5 cases × 1 agent generation × 3 LLM-judged scorers)

### 11. Eval gate (AIMock)

```bash
# Terminal 1: start AIMock
npx @copilotkit/aimock --port 4010

# Terminal 2:
USE_AIMOCK=true AIMOCK_URL=http://localhost:4010 npm run eval
```

**Pass**:
- Runs without real API calls
- Keyword/citation assertions evaluated
- Scorers skipped (n/a)
- Exit 0 if assertions pass, 1 otherwise

Note: AIMock won't return realistic answers for KB questions, so keyword assertions may fail. If so, document in PROGRESS.md and either:
- Configure AIMock fixtures with realistic responses for the canonical inputs (effort: ~30 min)
- Skip CI eval against AIMock, document that eval is a local-only check (acceptable for v1)

### 12. Mastra build

```bash
npm run build
```

**Pass**:
- `.mastra/output/index.mjs` produced
- Exit 0

### 13. Docker build & run

```bash
docker build -t template-mastra-rag:test .
docker compose up -d
sleep 15
curl http://localhost:4111/health
docker compose logs --tail=50 mastra
docker compose down
```

**Pass**:
- Build succeeds
- Container runs healthily
- `/health` returns 200
- Logs show no errors

Note: KB agent in container will fail to retrieve until you ingest. For v1 demo, ingestion is a manual step before container deploy. Document.

### 14. Onboarding test

Open the README. Pretend you're a new dev. Follow the quickstart end-to-end. Confirm the documented steps actually work.

**Pass**: from a clean clone, you can boot a working KB agent in under 10 minutes (5 base + 5 for ingest + corpus check).

## Reporting

For each test that fails, write to `PROGRESS.md`:

```
## Verification failures

### Test 5: Live smoke test
- Agent didn't include source citation
- Cause: instructions said "use the format [source: <filename>]" but agent ignored
- Fix: tightened instructions, added explicit example
- New result: pass
```

Document successful runs too — gives the owner confidence and a record for future runs.
