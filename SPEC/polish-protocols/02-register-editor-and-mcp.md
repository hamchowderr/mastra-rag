# RAG Polish 02 — Configure MCPServer + MastraEditor

## Step 1: Verify the knowledgeBase agent has a description

Open `src/mastra/agents/_example.ts`. Check the `knowledgeBaseAgent` constructor.

If description present, note the existing text in PROGRESS.md.

If not, add:

```typescript
description: 'Knowledge-base agent that answers questions about the project corpus using RAG. Retrieves relevant chunks from a pgvector index and grounds responses in source-cited context.'
```

## Step 2: Imports

At the top of `src/mastra/index.ts`:

```typescript
import { MastraEditor } from '@mastra/editor';
import { MCPServer } from '@mastra/mcp';
```

## Step 3: Construct the MCPServer

```typescript
const mcpServer = new MCPServer({
  id: 'rag-mcp',
  name: 'template-mastra-rag',
  version: '0.1.0',
  description: 'MCP server exposing template-mastra-rag knowledge-base agent as a tool',
  agents: { knowledgeBase: knowledgeBaseAgent },
});
```

## Step 4: Configure the Mastra constructor

RAG's existing constructor:

```typescript
export const mastra = new Mastra({
  agents: { knowledgeBase: knowledgeBaseAgent },
  scorers: { faithfulnessScorer, answerRelevancyScorer, contextRelevanceScorer },
  vectors: { pgVector: new PgVector({ ... }) },
  storage: new MastraCompositeStore({ ... }),
  logger: new PinoLogger({ ... }),
  observability: new Observability({ ... }),
});
```

Required state:

```typescript
export const mastra = new Mastra({
  agents: { knowledgeBase: knowledgeBaseAgent },
  scorers: { faithfulnessScorer, answerRelevancyScorer, contextRelevanceScorer },
  mcpServers: { ragMcp: mcpServer },
  vectors: { pgVector: new PgVector({ ... }) },  // unchanged
  storage: new MastraCompositeStore({ ... }),  // editor domain configured in Polish 01
  logger: new PinoLogger({ ... }),
  observability: new Observability({ ... }),
  editor: new MastraEditor(),
});
```

The existing `vectors` config must be preserved exactly — the retrieve tool depends on `vectorStoreName: 'pgVector'`.

## Step 5: Verify typecheck and dev boot

```bash
npm run typecheck
npm run dev
```

**Pass**:
- Typecheck zero errors
- Studio loads
- knowledgeBase agent visible
- Editor tab present
- Retrieval still works (chat with the agent — should retrieve from corpus)

If retrieval breaks, the `vectors` field got disturbed. Re-check Step 4.

## What to capture in PROGRESS.md

```
## RAG Polish 02: Configure MCPServer + MastraEditor
- Status: complete
- knowledgeBase description: <existing | added: ...>
- Imports added: MastraEditor, MCPServer
- Configuration: MCPServer instance + mcpServers and editor in Mastra constructor
- vectors config preserved: confirmed (retrieval test passes)
- Verification: typecheck passes; dev boots; Editor tab visible
- Notes: <anything unexpected>
```

Move on to Polish 03.
