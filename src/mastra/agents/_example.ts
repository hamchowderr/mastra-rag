import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PGVECTOR_PROMPT } from '@mastra/pg';

import { retrieve } from '../tools/retrieve';
import {
  faithfulnessScorer,
  answerRelevancyScorer,
  contextRelevanceScorer,
} from '../scorers/_example.scorers';

/**
 * # Knowledge Base Agent (canonical RAG example)
 *
 * Answers questions about Mastra's RAG documentation by retrieving
 * relevant chunks from a pgvector index and grounding responses
 * in the retrieved context. Cites source files inline.
 *
 * Pre-flight: run `npm run ingest` once to populate the vector index.
 *
 * Copy this file, swap the corpus, and adapt instructions for new RAG agents.
 */
export const knowledgeBaseAgent = new Agent({
  id: 'knowledgeBase',
  name: 'Knowledge Base',
  instructions: `You answer questions about Mastra's RAG documentation using the retrieve tool to fetch relevant context.

Rules:
- ALWAYS call the retrieve tool before answering. Never answer from your own knowledge alone.
- If retrieve returns no relevant chunks, say so plainly. Do not guess or fabricate.
- Cite sources inline using the format: [source: <filename>] after each claim.
- If the user's question is ambiguous or too broad, ask one clarifying question rather than guessing intent.
- Keep answers concise. Most questions deserve 1-3 paragraphs, not essays.
- Use code examples directly from the retrieved context when relevant — don't paraphrase code.
- For questions outside the Mastra RAG documentation corpus, say you cannot answer from the docs.

${PGVECTOR_PROMPT}`,
  model: 'openai/gpt-4o-mini',
  tools: { retrieve },
  memory: new Memory(),
  scorers: {
    faithfulness: {
      scorer: faithfulnessScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
    answerRelevancy: {
      scorer: answerRelevancyScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
    contextRelevance: {
      scorer: contextRelevanceScorer,
      sampling: { type: 'ratio', rate: 1 },
    },
  },
});
