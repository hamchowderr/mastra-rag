# Prompt: Build a New RAG Agent

Use this prompt to add a complete, production-ready RAG agent to this template. For a plain (non-RAG) agent, use `build-agent.md` instead.

---

## Inputs (fill these in before using the prompt)

```
AGENT_NAME:           <kebab-case name, e.g. "legal-docs">
AGENT_ID:             <camelCase id used in API routes, e.g. "legalDocs">
PURPOSE:              <one sentence: what corpus the agent covers and who calls it>
CORPUS:               <what documents live in data/corpus/ — topic, format, rough size>
RETRIEVAL_STRATEGY:   basic | filtered
                      basic = pure semantic search
                      filtered = semantic + metadata filter on source file or category
SYSTEM_PROMPT_FOCUS:  <describe the agent's persona and any domain constraints>
MODEL:                <default: openai/gpt-4o-mini>
EVAL_CASES:           <describe 4-5 test cases: one happy path citing source, one keyword
                       check, one multi-hop or edge case, one anti-hallucination refusal>
```

---

## Prompt

You are adding a new RAG agent to the `template-mastra-rag` Mastra project. Follow every convention in `AGENTS.md` exactly, especially the RAG conventions section.

**Agent to build**: `{AGENT_NAME}` (`{AGENT_ID}`)

**Purpose**: {PURPOSE}

**Corpus**: {CORPUS}

**Retrieval strategy**: {RETRIEVAL_STRATEGY}

**System prompt focus**: {SYSTEM_PROMPT_FOCUS}

**Model**: {MODEL}

---

### Deliverables

Produce these files and changes in order:

1. **`src/mastra/agents/{AGENT_NAME}.ts`**
   - Export the agent as `{camelCase}Agent` with `id: '{AGENT_ID}'`
   - `instructions` must:
     - Describe what the corpus is about (so the agent knows its domain)
     - Require calling `retrieve` before answering any question
     - Require citing the source file in every answer
     - Require refusing (not hallucinating) when the corpus doesn't cover the question
   - Include `PGVECTOR_PROMPT` from `@mastra/pg` appended to instructions
   - Import and include the shared `retrieve` tool from `../tools/retrieve`
   - Register the RAG scorer triplet with `sampling: { type: 'ratio', rate: 1 }`:
     - `faithfulness` → `faithfulnessScorer`
     - `answerRelevancy` → `answerRelevancyScorer`
     - `contextRelevance` → `contextRelevanceScorer`
   - Include a `Memory` instance

2. **`src/mastra/scorers/{AGENT_NAME}.scorers.ts`**
   - Export `faithfulnessScorer`, `answerRelevancyScorer`, `contextRelevanceScorer`
   - Import from `@mastra/evals/scorers/prebuilt`
   - `contextRelevanceScorer` must include a `contextExtractor` in its options — copy the pattern from `_example.scorers.ts` (reads `tool-invocation` parts from assistant message content)
   - Judge model: `openai/gpt-4o-mini`

3. **`src/mastra/scorers/datasets/{AGENT_NAME}.json`**
   - `agentId`: `{AGENT_ID}`
   - `thresholds`: `{ "faithfulness": 0.8, "answerRelevancy": 0.6, "contextRelevance": 0.55 }`
   - `cases`: minimum 5 — at least one `expectedSourceFile` citation check, at least one `expectedKeywords` check, at least one `expectedRefusal: true` anti-hallucination case
   - Do NOT include `expectedRefusal: true` cases in scorer aggregation (the eval runner handles this automatically)

4. **`src/mastra/index.ts`** — register the new agent:
   ```typescript
   import { {camelCase}Agent } from './agents/{AGENT_NAME}';
   // add to mastra({ agents: { ..., {AGENT_ID}: {camelCase}Agent } })
   // also register the new scorers in mastra({ scorers: { ... } })
   ```

---

### Constraints

- Never read `process.env` directly — use `env` from `../../lib/env`
- Never construct any AI SDK client before `configureAIMock()` runs
- Use relative imports only; no path aliases
- Model string format: `provider/model-id`
- Never reimplement retrieval inline — always use the shared `retrieve` tool from `../tools/retrieve`
- Never remove the source-citation requirement from the agent's instructions
- Scorer imports: use `@mastra/evals/scorers/prebuilt`, not `@mastra/evals/scorers/llm` or `@mastra/evals/scorers/code`
- `createContextRelevanceScorerLLM` requires `options.contextExtractor` — do not pass an empty object

---

### Implementation Order

1. Write the agent file (instructions + tools, no scorers yet) → `npm run typecheck`
2. Write the scorers file → `npm run typecheck`
3. Write the dataset JSON
4. Register agent + scorers in `index.ts` → `npm run typecheck`
5. `npm run dev` → verify agent appears in Studio
6. Send one live test question in Studio — confirm it calls `retrieve` and cites a source
7. Send one out-of-corpus question — confirm it refuses without hallucinating
8. `npm run eval` → confirm all assertion cases pass and exit 0

---

### Eval Cases Guidance

```
{EVAL_CASES}
```

**Anti-hallucination cases are mandatory.** The agent must refuse out-of-corpus questions — never fill in from training data. Mark these cases with `"expectedRefusal": true`.

**Citation cases**: Use `expectedSourceFile` to assert the agent mentions a specific source filename. The eval runner checks whether the filename (or its basename without `.md`) appears anywhere in the response.

**Keyword cases**: Use `expectedKeywords` with a conservative set — only terms that the corpus reliably contains and the agent will reliably surface. Avoid operator literals, proprietary names, or niche terms that may not appear in every answer.

**Scorer thresholds**: The defaults (`faithfulness: 0.8`, `answerRelevancy: 0.6`, `contextRelevance: 0.55`) are calibrated for the example agent. If your corpus is dense or highly technical, contextRelevance may need to be loosened further (0.5). Do not raise thresholds above the defaults without running live evals first.
