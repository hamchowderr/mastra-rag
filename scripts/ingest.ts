import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { embedMany } from 'ai';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';
import { PgVector } from '@mastra/pg';
import { MDocument } from '@mastra/rag';

import { env } from '../src/lib/env';

const CORPUS_DIR = 'data/corpus';
const EMBEDDING_DIMENSION = 1536; // text-embedding-3-small

async function main() {
  console.log(`Ingesting corpus from ${CORPUS_DIR}...`);

  const entries = await readdir(CORPUS_DIR);
  const files = entries.filter((f) => f.endsWith('.md'));
  if (files.length === 0) {
    throw new Error(`No markdown files found in ${CORPUS_DIR}`);
  }

  const store = new PgVector({
    id: 'pg-vector-ingest',
    connectionString: env.SUPABASE_DB_URL,
  });

  try {
    await store.createIndex({
      indexName: env.RAG_INDEX_NAME,
      dimension: EMBEDDING_DIMENSION,
    });
    console.log(`Created index: ${env.RAG_INDEX_NAME}`);
  } catch (err) {
    if (!(err instanceof Error) || !/already exists/i.test(err.message)) {
      throw err;
    }
    console.log(`Index ${env.RAG_INDEX_NAME} already exists, skipping create`);
  }

  const embeddingModel = new ModelRouterEmbeddingModel(env.RAG_EMBEDDING_MODEL);

  let totalChunks = 0;
  for (const file of files) {
    const filePath = join(CORPUS_DIR, file);
    const content = await readFile(filePath, 'utf-8');

    if (!content.trim()) {
      console.warn(`  ${file}: empty file, skipping`);
      continue;
    }

    const doc = MDocument.fromMarkdown(content);

    const chunks = await doc.chunk({
      strategy: 'markdown',
      maxSize: env.RAG_CHUNK_SIZE,
      overlap: env.RAG_CHUNK_OVERLAP,
    });

    if (chunks.length === 0) {
      console.warn(`  ${file}: produced 0 chunks, skipping`);
      continue;
    }

    console.log(`  ${file}: ${chunks.length} chunks`);

    const { embeddings } = await embedMany({
      model: embeddingModel,
      values: chunks.map((c) => c.text),
    });

    const ids = chunks.map((_, i) =>
      createHash('sha256').update(`${file}:${i}`).digest('hex').slice(0, 32),
    );

    await store.upsert({
      indexName: env.RAG_INDEX_NAME,
      vectors: embeddings,
      metadata: chunks.map((c, i) => ({
        text: c.text,
        source: file,
        chunkIndex: i,
      })),
      ids,
    });

    totalChunks += chunks.length;
  }

  console.log(`\nIngestion complete: ${totalChunks} chunks across ${files.length} files`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
