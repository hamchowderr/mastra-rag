# Retrieval in RAG systems

After storing embeddings, you need to retrieve relevant chunks to answer user queries.

Mastra provides flexible retrieval options with support for semantic search, filtering, and re-ranking.

## How retrieval works

1. The user's query is converted to an embedding using the same model used for document embeddings
2. This embedding is compared to stored embeddings using vector similarity
3. The most similar chunks are retrieved and can be optionally:

- Filtered by metadata
- Re-ranked for better relevance
- Processed through a knowledge graph

## Basic retrieval

The simplest approach is direct semantic search. This method uses vector similarity to find chunks that are semantically similar to the query:

```ts
import { embed } from 'ai'
import { PgVector } from '@mastra/pg'
import { ModelRouterEmbeddingModel } from '@mastra/core/llm'

// Convert query to embedding
const { embedding } = await embed({
  value: 'What are the main points in the article?',
  model: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
})

// Query vector store
const pgVector = new PgVector({
  id: 'pg-vector',
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
})
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 10,
})

// Display results
console.log(results)
```

The `topK` parameter specifies the maximum number of most similar results to return from the vector search.

Results include both the text content and a similarity score:

```ts
[
  {
    text: 'Climate change poses significant challenges...',
    score: 0.89,
    metadata: { source: 'article1.txt' },
  },
  {
    text: 'Rising temperatures affect crop yields...',
    score: 0.82,
    metadata: { source: 'article1.txt' },
  },
]
```

## Advanced retrieval options

### Metadata Filtering

Filter results based on metadata fields to narrow down the search space. This approach - combining vector similarity search with metadata filters - is sometimes called hybrid vector search, as it merges semantic search with structured filtering criteria.

Mastra provides a unified MongoDB-style query syntax that works across all supported vector stores. For detailed information about available operators and syntax, see the [Metadata Filters Reference](https://mastra.ai/reference/rag/metadata-filters).

Basic filtering examples:

```ts
// Simple equality filter
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 10,
  filter: {
    source: 'article1.txt',
  },
})

// Numeric comparison
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 10,
  filter: {
    price: { $gt: 100 },
  },
})

// Multiple conditions
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 10,
  filter: {
    category: 'electronics',
    price: { $lt: 1000 },
    inStock: true,
  },
})

// Array operations
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 10,
  filter: {
    tags: { $in: ['sale', 'new'] },
  },
})

// Logical operators
const results = await pgVector.query({
  indexName: 'embeddings',
  queryVector: embedding,
  topK: 10,
  filter: {
    $or: [{ category: 'electronics' }, { category: 'accessories' }],
    $and: [{ price: { $gt: 50 } }, { price: { $lt: 200 } }],
  },
})
```

Common use cases for metadata filtering:

- Filter by document source or type
- Filter by date ranges
- Filter by specific categories or tags
- Filter by numerical ranges (e.g., price, rating)
- Combine multiple conditions for precise querying
- Filter by document attributes (e.g., language, author)

### Vector Query Tool

Sometimes you want to give your agent the ability to query a vector database directly. The Vector Query Tool allows your agent to be in charge of retrieval decisions, combining semantic search with optional filtering and reranking based on the agent's understanding of the user's needs.

```ts
import { createVectorQueryTool } from '@mastra/rag'
import { ModelRouterEmbeddingModel } from '@mastra/core/llm'

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  model: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
})
```

When creating the tool, pay special attention to the tool's name and description - these help the agent understand when and how to use the retrieval capabilities.

This is particularly useful when:

- Your agent needs to dynamically decide what information to retrieve
- The retrieval process requires complex decision-making
- You want the agent to combine multiple retrieval strategies based on context

#### Database-Specific Configurations

The Vector Query Tool supports database-specific configurations that enable you to leverage unique features and optimizations of different vector stores.

> **Note:** These configurations are for **query-time options** like namespaces, performance tuning, and filtering — not for database connection setup.

```ts
import { createVectorQueryTool } from '@mastra/rag'
import { ModelRouterEmbeddingModel } from '@mastra/core/llm'

// pgVector with performance tuning
const pgVectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'postgres',
  indexName: 'embeddings',
  model: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
  databaseConfig: {
    pgvector: {
      minScore: 0.7, // Filter low-quality results
      ef: 200, // HNSW search parameter
      probes: 10, // IVFFlat probe parameter
    },
  },
})

// Pinecone with namespace
const pineconeQueryTool = createVectorQueryTool({
  vectorStoreName: 'pinecone',
  indexName: 'docs',
  model: new ModelRouterEmbeddingModel('openai/text-embedding-3-small'),
  databaseConfig: {
    pinecone: {
      namespace: 'production',
    },
  },
})
```

You can also override configurations at runtime using the request context:

```ts
import { RequestContext } from '@mastra/core/request-context'

const requestContext = new RequestContext()
requestContext.set('databaseConfig', {
  pinecone: {
    namespace: 'runtime-namespace',
  },
})

await pineconeQueryTool.execute({ queryText: 'search query' }, { mastra, requestContext })
```

### Vector Store Prompts

Vector store prompts define query patterns and filtering capabilities for each vector database implementation. When implementing filtering, these prompts are required in the agent's instructions to specify valid operators and syntax for each vector store implementation.

**pgVector**:

```ts
import { PGVECTOR_PROMPT } from '@mastra/pg'

export const ragAgent = new Agent({
  id: 'rag-agent',
  name: 'RAG Agent',
  model: 'openai/gpt-5.4',
  instructions: `
  Process queries using the provided context. Structure responses to be concise and relevant.
  ${PGVECTOR_PROMPT}
  `,
  tools: { vectorQueryTool },
})
```

**Pinecone**:

```ts
import { PINECONE_PROMPT } from '@mastra/pinecone'
```

**Qdrant**:

```ts
import { QDRANT_PROMPT } from '@mastra/qdrant'
```

**Chroma**:

```ts
import { CHROMA_PROMPT } from '@mastra/chroma'
```

**libSQL**:

```ts
import { LIBSQL_PROMPT } from '@mastra/libsql'
```

**Upstash**:

```ts
import { UPSTASH_PROMPT } from '@mastra/upstash'
```

### Re-ranking

Initial vector similarity search can sometimes miss nuanced relevance. Re-ranking improves results by:

- Considering word order and exact matches
- Applying more sophisticated relevance scoring
- Using cross-attention between query and documents

```ts
import { rerankWithScorer as rerank, MastraAgentRelevanceScorer } from '@mastra/rag'

// Get initial results from vector search
const initialResults = await pgVector.query({
  indexName: 'embeddings',
  queryVector: queryEmbedding,
  topK: 10,
})

// Create a relevance scorer
const relevanceProvider = new MastraAgentRelevanceScorer('relevance-scorer', 'openai/gpt-5.4')

// Re-rank the results
const rerankedResults = await rerank({
  results: initialResults,
  query,
  scorer: relevanceProvider,
  options: {
    weights: {
      semantic: 0.5, // How well the content matches the query semantically
      vector: 0.3, // Original vector similarity score
      position: 0.2, // Preserves original result ordering
    },
    topK: 10,
  },
})
```

The weights control how different factors influence the final ranking:

- `semantic`: Higher values prioritize semantic understanding and relevance to the query
- `vector`: Higher values favor the original vector similarity scores
- `position`: Higher values help maintain the original ordering of results

> **Note:** For semantic scoring to work properly during re-ranking, each result must include the text content in its `metadata.text` field.

You can also use other relevance score providers:

```ts
const relevanceProvider = new CohereRelevanceScorer('rerank-v3.5')
```

```ts
const relevanceProvider = new ZeroEntropyRelevanceScorer('zerank-1')
```

For more details about re-ranking, see the [rerank() reference](https://mastra.ai/reference/rag/rerankWithScorer).

For graph-based retrieval that follows connections between chunks, see the [GraphRAG documentation](https://mastra.ai/docs/rag/graph-rag).
