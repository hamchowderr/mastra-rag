import { env } from '../lib/env';

import { configureAIMock } from './lib/aimock';
configureAIMock();

import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore, PgVector } from '@mastra/pg';
import { DuckDBStore } from '@mastra/duckdb';
import { MastraCompositeStore } from '@mastra/core/storage';
import { Observability, DefaultExporter, SensitiveDataFilter, MastraPlatformExporter } from '@mastra/observability';
import { MastraEditor } from '@mastra/editor';
import { MCPServer } from '@mastra/mcp';
import { MastraJwtAuth } from '@mastra/auth';

import { knowledgeBaseAgent } from './agents/_example';
import {
  faithfulnessScorer,
  answerRelevancyScorer,
  contextRelevanceScorer,
} from './scorers/_example.scorers';
import { doltTools } from './tools/dolt';
import { ensureDatabase, doltConfigured } from './lib/dolt';

// Bootstrap the versioned Dolt database on first boot (no-op if Dolt isn't configured).
if (doltConfigured) {
  await ensureDatabase();
}

const mcpServer = new MCPServer({
  id: 'rag-mcp',
  name: 'template-mastra-rag',
  version: '0.1.0',
  description: 'MCP server exposing template-mastra-rag knowledge-base agent + Dolt tools',
  // Dolt versioned-data tools exposed over MCP.
  tools: { ...doltTools },
  agents: { knowledgeBase: knowledgeBaseAgent },
});

const pgStore = new PostgresStore({ id: 'mastra-storage', connectionString: env.SUPABASE_DB_URL });

// JWT auth: when MASTRA_JWT_SECRET is set, gate all /api/* routes AND Studio
// behind a Bearer JWT signed with the shared secret. `/health` and `/api/auth/*`
// stay public (healthchecks + Studio login screen still work). Leave the secret
// unset for open local dev. Shared-secret only — no external provider.
const server = env.MASTRA_JWT_SECRET
  ? { auth: new MastraJwtAuth({ secret: env.MASTRA_JWT_SECRET }) }
  : undefined;

export const mastra = new Mastra({
  ...(server ? { server } : {}),
  agents: { knowledgeBase: knowledgeBaseAgent },
  mcpServers: { ragMcp: mcpServer },
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
  // Single shared Postgres store instance for both default + editor slots.
  // Two separate PostgresStore instances on the same DB race on first boot,
  // both creating shared types (e.g. mastra_ai_spans) -> 23505 unique violation.
  storage: new MastraCompositeStore({
    id: 'composite-storage',
    default: pgStore,
    editor: pgStore,
    domains: {
      observability: await new DuckDBStore().getStore('observability'),
    },
  }),
  logger: new PinoLogger({ name: 'Mastra', level: env.LOG_LEVEL }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra-rag',
        // Local traces always; also ship to hosted Mastra Observe when creds are set
        // (MASTRA_PLATFORM_ACCESS_TOKEN + MASTRA_PROJECT_ID) — no-op otherwise.
        exporters: [
          new DefaultExporter(),
          ...(process.env.MASTRA_PLATFORM_ACCESS_TOKEN && process.env.MASTRA_PROJECT_ID
            ? [new MastraPlatformExporter()]
            : []),
        ],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  editor: new MastraEditor(),
});
