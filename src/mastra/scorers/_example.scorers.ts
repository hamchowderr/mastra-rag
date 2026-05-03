import {
  createFaithfulnessScorer,
  createAnswerRelevancyScorer,
  createContextRelevanceScorerLLM,
} from '@mastra/evals/scorers/prebuilt';
import type { ScorerRunOutputForAgent } from '@mastra/core/evals';

const judgeModel = 'openai/gpt-4o-mini';

export const faithfulnessScorer = createFaithfulnessScorer({
  model: judgeModel,
});

export const answerRelevancyScorer = createAnswerRelevancyScorer({
  model: judgeModel,
});

export const contextRelevanceScorer = createContextRelevanceScorerLLM({
  model: judgeModel,
  options: {
    contextExtractor: (_input, output: ScorerRunOutputForAgent) => {
      const chunks: string[] = [];
      for (const msg of output) {
        if (msg.role !== 'assistant') continue;
        const parts = msg.content?.parts ?? [];
        for (const part of parts) {
          const p = part as Record<string, unknown>;
          if (p['type'] === 'tool-invocation') {
            const inv = p['toolInvocation'] as Record<string, unknown> | undefined;
            if (inv?.['state'] === 'result') {
              const result = inv['result'];
              chunks.push(typeof result === 'string' ? result : JSON.stringify(result));
            }
          }
        }
      }
      return chunks.length > 0 ? chunks : ['(no retrieved context)'];
    },
  },
});
