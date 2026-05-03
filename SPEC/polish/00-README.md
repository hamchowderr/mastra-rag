# RAG Polish Spec — Final Cleanup & Publish

The RAG template build is functionally complete (all 13 phases passing per `SPEC/PROGRESS.md`). This polish pass is short — only 2 substantive steps + optional smoke test — because RAG didn't accumulate the same quality/fragility issues that voice did.

## Read these files in order

1. **`00-README.md`** (this file) — operating instructions
2. **`01-cleanup-and-package-fix.md`** — fix `package.json` name + delete the stray `fixtures;C` directory
3. **`02-github-publish.md`** — push to GitHub, configure CI, verify CI runs green, tag v0.1.0

## Operating mode for this pass

- **Stop and ask if you find a real bug.** This polish phase validates and publishes what's built. New bugs surface before fixing.
- **Update `SPEC/PROGRESS.md`** with a `## RAG Polish 0X` entry after each step.
- **Don't introduce new dependencies.** No new packages.
- **Don't refactor working code.** Only what these specs explicitly call for.
- **Time budget**: 30–45 minutes total.

## Order of operations

```
01 (cleanup + package fix)   → trivial; do first to clear noise
02 (GitHub publish)          → final gate; depends on 01 being done
```

## Reporting

After both polish steps complete, write a final entry in `PROGRESS.md`:

```
## RAG Polish Complete
- Status: complete | blocked
- Both polish steps: <pass/fail>
- Repo URL: https://github.com/hamchowderr/template-mastra-rag
- v0.1.0 tag: pushed
- Recommended next action: ready to start NCA template (after owner fixes flagged spec errors)
```
