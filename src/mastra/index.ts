import { env } from '../lib/env';

import { configureAIMock } from './lib/aimock';
configureAIMock();

import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore, PgVector } from '@mastra/pg';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraCompositeStore } from '@mastra/core/storage';
import { Observability, DefaultExporter, SensitiveDataFilter } from '@mastra/observability';

import { knowledgeBaseAgent } from './agents/_example';
import {
  faithfulnessScorer,
  answerRelevancyScorer,
  contextRelevanceScorer,
} from './scorers/_example.scorers';

export const mastra = new Mastra({
  agents: { knowledgeBase: knowledgeBaseAgent },
  vectors: {
    pgVector: new PgVector({
      id: 'pg-vector',
      connectionString: env.SUPABASE_DB_URL,
    }),
  },
  scorers: {
    faithfulness: faithfulnessScorer,
    answerRelevancy: answerRelevancyScorer,
    contextRelevance: contextRelevanceScorer,
  },
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: new PostgresStore({ id: 'mastra-storage', connectionString: env.SUPABASE_DB_URL }),
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    },
  }),
  logger: new PinoLogger({ name: 'Mastra', level: env.LOG_LEVEL }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new DefaultExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
});
