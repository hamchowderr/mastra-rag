# template-mastra-rag — Build Spec

You (the AI coding agent) are building the RAG child template by forking from `template-mastra-base` and layering in pgvector, document ingestion, retrieval, and a knowledge-base agent.

## Read these spec files in order

1. **`01-context.md`** — What this template is, what it inherits from base, what's new
2. **`02-architecture.md`** — File layout, dependencies, env vars added on top of base
3. **`03-files.md`** — Per-file specs with code targets and acceptance criteria
4. **`04-build-order.md`** — Strict phase order with verification checkpoints
5. **`05-verification.md`** — End-to-end test plan
6. **`06-known-gotchas.md`** — Pitfalls (inherits from base + RAG-specific)

## Operating mode

Same as base:

- **Stay in scope.** Don't add features not in the spec. The example agent and corpus are deliberate choices.
- **Use Mastra's RAG primitives.** `MDocument`, `embedMany`, `PgVector`, `createVectorQueryTool` from `@mastra/rag`. Do not reinvent chunking or retrieval.
- **Verify as you go.** Each phase has a checkpoint. Hit it before moving on.
- **Ask before installing packages outside the deps list in `02-architecture.md`.**
- **Stop after each phase**, write a status entry to `SPEC/PROGRESS.md`, wait for the owner's "continue."
- **Do not modify the env loader's existing fields** unless adding new ones. The base env validation contract is stable.

## Owner context

This template forks from `template-mastra-base` (already published at `https://github.com/hamchowderr/template-mastra-base`). The base provides: env loader, AIMock support, observability, Postgres memory adapter via `@mastra/pg`, Docker, scorers, CI workflow.

This template adds: pgvector enabled in Supabase, document corpus, ingestion pipeline, retrieval tool, knowledge-base agent that uses RAG to answer questions about its corpus.

The corpus is **Mastra's own documentation**. Specifically the RAG section — the 4 markdown pages the owner provided in the conversation transcript. These ship as static markdown files in the template repo at `data/corpus/`. The KB agent answers questions like "how do I chunk markdown?" or "what vector stores does Mastra support?". No refresh script, no auto-update — the snapshot is frozen at template-creation time and the owner re-snapshots when they ship a new template version.

## Reporting

Same format as base's `PROGRESS.md`:

```
## Phase N: <name>
- Status: complete | blocked | skipped
- Files touched: <list>
- Verification: <pass | fail | n/a>
- Notes: <deviations from spec, gotchas, anything the owner should know>
```

If you get stuck, write the blocker into `PROGRESS.md` and stop. Don't paper over with workarounds.

## Critical: gotchas inherited from the base build

These were discovered during the base build and apply here too. Read `SPEC/06-known-gotchas.md` for the full list. The high-impact ones:

1. **AIMock requires OpenAI as the eval-time model**, not Anthropic. AIMock only supports OpenAI-compatible endpoints. Agents in this template default to OpenAI (specifically `openai/gpt-5-mini` or similar) for eval compatibility.
2. **Path aliases break inside `src/mastra/`** — relative imports only.
3. **PostgresStore and PgVector both require an `id` field** on construction.
4. **Provisioning uses `npx degit <org>/<repo>`**, NOT `npx create-mastra --template`. The latter doesn't accept arbitrary GitHub repos.
5. **DuckDB requires glibc** — Docker uses `node:22-slim`, not Alpine. Inherited from base, don't change.
6. **Top-level await works** because tsconfig has `module: ES2022` and `target: ES2022`. The MastraCompositeStore init uses it.
7. **PostHog telemetry leaks errors in restricted networks** — set `MASTRA_TELEMETRY_DISABLED=1` in CI and `.env`.

Begin with `01-context.md`.
