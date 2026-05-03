# Storing embeddings in a vector database

After generating embeddings, you need to store them in a database that supports vector similarity search. Mastra provides a consistent interface for storing and querying embeddings across various vector databases.

## Supported databases

**MongoDB**:

```ts
import { MongoDBVector } from '@mastra/mongodb'

const store = new MongoDBVector({
  id: 'mongodb-vector',
  uri: process.env.MONGODB_URI,
  dbName: process.env.MONGODB_DATABASE,
})
await store.createIndex({
  indexName: 'myCollection',
  dimension: 1536,
})
await store.upsert({
  indexName: 'myCollection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

### Using MongoDB Atlas Vector search

For detailed setup instructions and best practices, see the [official MongoDB Atlas Vector Search documentation](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-overview/).

**PgVector**:

```ts
import { PgVector } from '@mastra/pg'

const store = new PgVector({
  id: 'pg-vector',
  connectionString: process.env.POSTGRES_CONNECTION_STRING,
})

await store.createIndex({
  indexName: 'myCollection',
  dimension: 1536,
})

await store.upsert({
  indexName: 'myCollection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

### Using PostgreSQL with pgvector

PostgreSQL with the pgvector extension is a good solution for teams already using PostgreSQL who want to minimize infrastructure complexity. For detailed setup instructions and best practices, see the [official pgvector repository](https://github.com/pgvector/pgvector).

**Pinecone**:

```ts
import { PineconeVector } from '@mastra/pinecone'

const store = new PineconeVector({
  id: 'pinecone-vector',
  apiKey: process.env.PINECONE_API_KEY,
})
await store.createIndex({
  indexName: 'myCollection',
  dimension: 1536,
})
await store.upsert({
  indexName: 'myCollection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

**Qdrant**:

```ts
import { QdrantVector } from '@mastra/qdrant'

const store = new QdrantVector({
  id: 'qdrant-vector',
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
})

await store.createIndex({
  indexName: 'myCollection',
  dimension: 1536,
})

await store.upsert({
  indexName: 'myCollection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

**Chroma**:

```ts
import { ChromaVector } from '@mastra/chroma'

// Running Chroma locally
// const store = new ChromaVector()

// Running on Chroma Cloud
const store = new ChromaVector({
  id: 'chroma-vector',
  apiKey: process.env.CHROMA_API_KEY,
  tenant: process.env.CHROMA_TENANT,
  database: process.env.CHROMA_DATABASE,
})

await store.createIndex({
  indexName: 'myCollection',
  dimension: 1536,
})

await store.upsert({
  indexName: 'myCollection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

**Astra**:

```ts
import { AstraVector } from '@mastra/astra'

const store = new AstraVector({
  id: 'astra-vector',
  token: process.env.ASTRA_DB_TOKEN,
  endpoint: process.env.ASTRA_DB_ENDPOINT,
  keyspace: process.env.ASTRA_DB_KEYSPACE,
})

await store.createIndex({
  indexName: 'myCollection',
  dimension: 1536,
})

await store.upsert({
  indexName: 'myCollection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

**libSQL**:

```ts
import { LibSQLVector } from '@mastra/core/vector/libsql'

const store = new LibSQLVector({
  id: 'libsql-vector',
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN, // Optional: for Turso cloud databases
})

await store.createIndex({
  indexName: 'myCollection',
  dimension: 1536,
})

await store.upsert({
  indexName: 'myCollection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

**Upstash**:

```ts
import { UpstashVector } from '@mastra/upstash'

// In upstash they refer to the store as an index
const store = new UpstashVector({
  id: 'upstash-vector',
  url: process.env.UPSTASH_URL,
  token: process.env.UPSTASH_TOKEN,
})

// There is no store.createIndex call here, Upstash creates indexes (known as namespaces in Upstash) automatically
// when you upsert if that namespace does not exist yet.
await store.upsert({
  indexName: 'myCollection', // the namespace name in Upstash
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

**Cloudflare**:

```ts
import { CloudflareVector } from '@mastra/vectorize'

const store = new CloudflareVector({
  id: 'cloudflare-vector',
  accountId: process.env.CF_ACCOUNT_ID,
  apiToken: process.env.CF_API_TOKEN,
})
await store.createIndex({
  indexName: 'myCollection',
  dimension: 1536,
})
await store.upsert({
  indexName: 'myCollection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

**OpenSearch**:

```ts
import { OpenSearchVector } from '@mastra/opensearch'

const store = new OpenSearchVector({ id: 'opensearch', node: process.env.OPENSEARCH_URL })

await store.createIndex({
  indexName: 'my-collection',
  dimension: 1536,
})

await store.upsert({
  indexName: 'my-collection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

**Elasticsearch**:

```ts
import { ElasticSearchVector } from '@mastra/elasticsearch'

const store = new ElasticSearchVector({
  id: 'elasticsearch-vector',
  url: process.env.ELASTICSEARCH_URL,
  auth: {
    apiKey: process.env.ELASTICSEARCH_API_KEY,
  },
})

await store.createIndex({
  indexName: 'my-collection',
  dimension: 1536,
})

await store.upsert({
  indexName: 'my-collection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

**Couchbase**:

```ts
import { CouchbaseVector } from '@mastra/couchbase'

const store = new CouchbaseVector({
  id: 'couchbase-vector',
  connectionString: process.env.COUCHBASE_CONNECTION_STRING,
  username: process.env.COUCHBASE_USERNAME,
  password: process.env.COUCHBASE_PASSWORD,
  bucketName: process.env.COUCHBASE_BUCKET,
  scopeName: process.env.COUCHBASE_SCOPE,
  collectionName: process.env.COUCHBASE_COLLECTION,
})
await store.createIndex({
  indexName: 'myCollection',
  dimension: 1536,
})
await store.upsert({
  indexName: 'myCollection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

**Lance**:

```ts
import { LanceVectorStore } from '@mastra/lance'

const store = await LanceVectorStore.create('/path/to/db')

await store.createIndex({
  tableName: 'myVectors',
  indexName: 'myCollection',
  dimension: 1536,
})

await store.upsert({
  tableName: 'myVectors',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

**S3 Vectors**:

```ts
import { S3Vectors } from '@mastra/s3vectors'

const store = new S3Vectors({
  id: 's3-vectors',
  vectorBucketName: 'my-vector-bucket',
  clientConfig: {
    region: 'us-east-1',
  },
  nonFilterableMetadataKeys: ['content'],
})

await store.createIndex({
  indexName: 'my-index',
  dimension: 1536,
})
await store.upsert({
  indexName: 'my-index',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({ text: chunk.text })),
})
```

## Using vector storage

Once initialized, all vector stores share the same interface for creating indexes, upserting embeddings, and querying.

### Creating Indexes

Before storing embeddings, you need to create an index with the appropriate dimension size for your embedding model:

```ts
// Create an index with dimension 1536 (for text-embedding-3-small)
await store.createIndex({
  indexName: 'myCollection',
  dimension: 1536,
})
```

The dimension size must match the output dimension of your chosen embedding model. Common dimension sizes are:

- `OpenAI text-embedding-3-small`: 1536 dimensions (or custom, e.g., 256)
- `Cohere embed-multilingual-v3`: 1024 dimensions
- `Google gemini-embedding-001`: 768 dimensions (or custom)

> **Warning:** Index dimensions can't be changed after creation. To use a different model, delete and recreate the index with the new dimension size.

### Naming Rules for Databases

Each vector database enforces specific naming conventions for indexes and collections to ensure compatibility and prevent conflicts.

**PgVector**:

Index names must:

- Start with a letter or underscore
- Contain only letters, numbers, and underscores
- Example: `my_index_123` is valid
- Example: `my-index` is not valid (contains hyphen)

**Pinecone**:

Index names must:

- Use only lowercase letters, numbers, and dashes
- Not contain dots (used for DNS routing)
- Not use non-Latin characters or emojis
- Have a combined length (with project ID) under 52 characters

**Qdrant**:

Collection names must:

- Be 1-255 characters long
- Not contain any of these special characters: `< > : " / \ | ? *`

**Chroma**:

Collection names must:

- Be 3-63 characters long
- Start and end with a letter or number
- Contain only letters, numbers, underscores, or hyphens
- Not contain consecutive periods (..)

### Upserting Embeddings

After creating an index, you can store embeddings along with their basic metadata:

```ts
// Store embeddings with their corresponding metadata
await store.upsert({
  indexName: 'myCollection', // index name
  vectors: embeddings, // array of embedding vectors
  metadata: chunks.map(chunk => ({
    text: chunk.text, // The original text content
    id: chunk.id, // Optional unique identifier
  })),
})
```

The upsert operation:

- Takes an array of embedding vectors and their corresponding metadata
- Updates existing vectors if they share the same ID
- Creates new vectors if they don't exist
- Automatically handles batching for large datasets

## Adding metadata

Vector stores support rich metadata (any JSON-serializable fields) for filtering and organization. Since metadata is stored with no fixed schema, use consistent field naming to avoid unexpected query results.

> **Warning:** Metadata is crucial for vector storage - without it, you'd only have numerical embeddings with no way to return the original text or filter results. Always store at least the source text as metadata.

```ts
// Store embeddings with rich metadata for better organization and filtering
await store.upsert({
  indexName: 'myCollection',
  vectors: embeddings,
  metadata: chunks.map(chunk => ({
    // Basic content
    text: chunk.text,
    id: chunk.id,

    // Document organization
    source: chunk.source,
    category: chunk.category,

    // Temporal metadata
    createdAt: new Date().toISOString(),
    version: '1.0',

    // Custom fields
    language: chunk.language,
    author: chunk.author,
    confidenceScore: chunk.score,
  })),
})
```

Key metadata considerations:

- Be strict with field naming - inconsistencies like 'category' vs 'Category' will affect queries
- Only include fields you plan to filter or sort by - extra fields add overhead
- Add timestamps (e.g., 'createdAt', 'lastUpdated') to track content freshness

## Deleting vectors

When building RAG applications, you often need to clean up stale vectors when documents are deleted or updated. Mastra provides the `deleteVectors` method that supports deleting vectors by metadata filters.

### Delete by Metadata Filter

```ts
// Delete all vectors for a specific document
await store.deleteVectors({
  indexName: 'myCollection',
  filter: { docId: 'document-123' },
})
```

### Delete Multiple Documents

```ts
// Delete all vectors for multiple documents
await store.deleteVectors({
  indexName: 'myCollection',
  filter: {
    docId: { $in: ['doc-1', 'doc-2', 'doc-3'] },
  },
})

// Delete vectors for a specific user's documents
await store.deleteVectors({
  indexName: 'myCollection',
  filter: {
    $and: [{ userId: 'user-123' }, { status: 'archived' }],
  },
})
```

### Delete by Vector IDs

```ts
// Delete specific vectors by their IDs
await store.deleteVectors({
  indexName: 'myCollection',
  ids: ['vec-1', 'vec-2', 'vec-3'],
})
```

## Best practices

- Create indexes before bulk insertions
- Use batch operations for large insertions (the upsert method handles batching automatically)
- Only store metadata you'll query against
- Match embedding dimensions to your model (e.g., 1536 for `text-embedding-3-small`)
