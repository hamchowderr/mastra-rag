import { createVectorQueryTool } from '@mastra/rag';
import { ModelRouterEmbeddingModel } from '@mastra/core/llm';

import { env } from '../../lib/env';

export const retrieve = createVectorQueryTool({
  id: 'retrieve',
  description:
    'Searches the Mastra RAG documentation corpus for chunks relevant to the query. Always call this before answering a question about Mastra RAG features.',
  vectorStoreName: 'pgVector',
  indexName: env.RAG_INDEX_NAME,
  model: new ModelRouterEmbeddingModel(env.RAG_EMBEDDING_MODEL),
  enableFilter: true,
});
