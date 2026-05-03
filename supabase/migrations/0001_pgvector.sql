-- Enable pgvector extension for vector similarity search
-- Required by @mastra/pg's PgVector class for RAG operations
CREATE EXTENSION IF NOT EXISTS vector;
