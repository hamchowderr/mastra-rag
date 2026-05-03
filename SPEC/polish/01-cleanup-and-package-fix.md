# RAG Polish 01 — Cleanup & Package Name Fix

Two trivial fixes before publishing.

## Fix 1: package.json name

Currently says `"name": "template-mastra-base"` because the build forked from base via degit and didn't update the field. Will be confusing once published.

### Steps

1. Open `package.json` in the project root.
2. Change line 2 from:
   ```json
   "name": "template-mastra-base",
   ```
   to:
   ```json
   "name": "template-mastra-rag",
   ```
3. Save.

### Verify

```bash
npm run typecheck
```

**Pass**: still passes.

```bash
cat package.json | grep '"name"'
```

**Pass**: shows `"name": "template-mastra-rag"`.

---

## Fix 2: Delete stray `fixtures;C` directory

The repo has an empty directory at `fixtures;C` — created accidentally by a Windows command that interpreted `;` as a path separator. Should not ship.

### Steps

1. Verify it's empty:
   ```bash
   dir "fixtures;C"
   ```
   Should show no files.
2. Delete it:
   ```bash
   rmdir "fixtures;C"
   ```
   (Use quotes; the semicolon is special to PowerShell and cmd.)
3. Verify it's gone:
   ```bash
   dir | findstr fixtures
   ```
   Should show only `fixtures` (without the `;C` artifact).

If the directory has anything in it (it shouldn't, but verify), do NOT delete without checking the contents first.

---

## What to capture in PROGRESS.md

```
## RAG Polish 01: Cleanup & Package Name Fix
- Status: complete
- Files changed: package.json (one line), fixtures;C (deleted)
- Verification: typecheck still passes; fixtures;C confirmed gone
```

That's the whole step. Move on to RAG Polish 02.
