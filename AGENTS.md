# AGENTS.md — Conventions for AI Coding Agents

This file is for AI coding agents (Claude Code, Cursor, Copilot, etc.) working on this codebase. It describes conventions, rules, and things to never do.

---

## Boot Order (critical)

`src/mastra/index.ts` must initialize in this exact order:

```
1. env validation   (import env from '../lib/env')
2. AIMock setup     (configureAIMock())
3. Mastra instance  (new Mastra({ ... }))
```

**Why**: The Vercel AI SDK reads provider base URLs at client instantiation and caches them. AIMock must overwrite env vars before any AI SDK client is constructed. Env must validate before AIMock so it can read `USE_AIMOCK` and `AIMOCK_URL`.

Never reorder these. Never construct an `Agent` or `@ai-sdk/*` client before `configureAIMock()` is called.

---

## Import Rules

- Use **relative imports** for everything inside `src/mastra/`
- `src/lib/env` is the only cross-boundary import allowed in `src/mastra/`
- Never import from `src/mastra/` in `src/lib/`
- Never use barrel/index files — import from the specific file

```typescript
// correct
import { env } from '../../lib/env';
import { leadIntakeAgent } from './agents/_example';

// wrong
import { env } from '@/lib/env';           // no path aliases
import { leadIntakeAgent } from './agents'; // no barrel imports
```

---

## Environment Variables

All env vars flow through `src/lib/env.ts`. This is the single source of truth.

Rules:
- Never read `process.env.*` directly outside of `src/lib/env.ts`
- When adding a new env var: add to the Zod schema in `env.ts` AND to `.env.example` at the same time
- Optional vars use `.optional()` in the schema; required vars have no default
- Boolish vars (`USE_AIMOCK`) use the `boolish` transform defined at the top of `env.ts`

---

## Agent Conventions

File naming: `src/mastra/agents/<kebab-name>.ts` (prefix `_` for examples/templates).

Every agent file must export:
1. A named Zod schema (e.g. `LeadSchema`) and its inferred type
2. The agent instance with `id`, `name`, `instructions`, `model`, and `scorers`

Model string format: `anthropic/claude-sonnet-4-6` (provider/model-id).

Scorers are declared inline on the agent. Scorer implementations live in `src/mastra/scorers/`. Every agent should have at least a hallucination scorer.

Tools used only by one agent live inline in that agent's file. Shared tools go in `src/mastra/tools/`.

---

## Scorer Conventions

File naming: `src/mastra/scorers/<agent-name>.scorers.ts`.

Dataset files: `src/mastra/scorers/datasets/<agent-name>.json`.

Every scorer file exports named scorers. Every dataset file has `agentId`, `thresholds`, and `cases` — minimum 5 cases, at least 1 anti-hallucination case.

Correct import paths for prebuilt scorers:
```typescript
import { createHallucinationScorer, createPromptAlignmentScorerLLM } from '@mastra/evals/scorers/prebuilt';
// NOT from '@mastra/evals/scorers/llm' or '@mastra/evals/scorers/code'
```

Note: `createPromptAlignmentScorerLLM` with `evaluationMode: 'system'` requires system-prompt data in the inline scorer input. Register it on the agent only without that option, or run it manually in eval.ts. The default (no `evaluationMode`) works correctly for both inline and manual use.

---

## Storage

The Mastra instance uses a composite store:
- **default domain** → `PostgresStore` (Supabase Postgres via `SUPABASE_DB_URL`)
- **observability domain** → `DuckDBStore`

Both require an explicit `id` field:
```typescript
new PostgresStore({ id: 'mastra-storage', connectionString: env.SUPABASE_DB_URL })
```

`DuckDBStore` requires glibc. Do not run it in Alpine-based containers — use `node:22-slim`.

---

## RAG Conventions

This project is a RAG template. Every agent answers questions about a corpus of documents.

**Always use the `retrieve` tool — never reimplement retrieval inline.**

```typescript
import { retrieve } from '../tools/retrieve';
// add to agent tools: { retrieve }
```

**Always cite sources.** The agent's instructions require it to mention the source file when answering. Do not remove or weaken this requirement.

**Never answer from training data when the corpus is the source of truth.** The agent must call `retrieve` before answering any corpus question. If retrieval returns no relevant chunks, the agent must say so — it must never fill in from its own knowledge.

**Refusal cases are required in every eval dataset.** Include at least one `expectedRefusal: true` case (e.g., an out-of-corpus question). Exclude these cases from scorer aggregation — a score of 0 on a correct refusal is expected behavior, not a failure.

**RAG scorer triplet**: faithfulness, answerRelevancy, contextRelevance. Register all three on every RAG agent. Correct import path:

```typescript
import {
  createFaithfulnessScorer,
  createAnswerRelevancyScorer,
  createContextRelevanceScorerLLM,
} from '@mastra/evals/scorers/prebuilt';
```

`createContextRelevanceScorerLLM` requires a `contextExtractor` in `options`. Use the one from `_example.scorers.ts` as a template — it reads `tool-invocation` parts from assistant message content.

**Corpus changes require a re-ingest.** If you edit `data/corpus/` or change `RAG_EMBEDDING_MODEL`, run `npm run ingest` to rebuild the index.

---

## Things to Never Do

- **Never read `process.env` directly** — use `env` from `src/lib/env.ts`
- **Never construct an AI SDK client before `configureAIMock()`** — AIMock will be bypassed silently
- **Never set `ANTHROPIC_BASE_URL = AIMOCK_URL` bare** — `@ai-sdk/anthropic` appends `/messages`, so set it to `${AIMOCK_URL}/v1` to land at `/v1/messages` (where AIMock actually listens)
- **Never change the Dockerfile base to `node:22-alpine`** or any musl-based image — DuckDB native binaries will SIGSEGV at runtime. If you genuinely need a smaller image, swap `DuckDBStore` for `LibSQLStore` in the observability domain in `src/mastra/index.ts` instead. See README "Deployment Notes".
- **Never add a new env var without updating `.env.example`** — new devs won't know it exists
- **Never skip the Zod schema for a new env var** — process will start with undefined values silently
- **Never import from `src/mastra/` in `src/lib/`** — creates circular dependency risk
- **Never register an agent before its file passes typecheck** — comment it out until types are clean
- **Never use barrel/index imports** — import from the specific file

---

## Ask Before Acting

Stop and confirm with the user before making these changes:

- Changing the boot order in `src/mastra/index.ts`
- Removing or renaming a scorer that's referenced in a dataset JSON
- Downgrading a Mastra package version
- Adding a new `domain` to the composite store
- Any Supabase schema migrations

---

## Useful Commands

```bash
npm run dev          # Start Studio at localhost:4111
npm run typecheck    # Verify types before running
npm run eval         # Run all eval cases; exits 0 on pass, 1 on fail
npx supabase start   # Start local Supabase (Docker required)
```

Eval runs with `USE_AIMOCK=false` hit the real Anthropic API and incur cost. Use `USE_AIMOCK=true` with AIMock running for free deterministic runs during development.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
