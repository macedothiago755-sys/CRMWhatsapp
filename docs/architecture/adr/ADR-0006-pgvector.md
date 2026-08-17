# ADR-0006: pgvector for RAG embeddings

## Status
Accepted

## Context
The Knowledge/RAG pipeline (documents → chunks → embeddings → retrieval) needs vector similarity search.
A dedicated vector database (Pinecone, Weaviate, Qdrant, etc.) is one option; running vectors inside the
existing PostgreSQL instance via the `pgvector` extension is another.

## Decision
Use `pgvector` in the same PostgreSQL database (`knowledge.embedding.vector`) as the initial RAG storage,
rather than standing up a separate vector database.

## Rationale
- Master prompt explicitly directs avoiding a separate vector database "without necessity" (§5, §67).
- Keeps knowledge data transactionally consistent with the documents/chunks it's derived from (one
  database, one backup/restore story, one migration pipeline).
- `pgvector` is sufficient for the expected initial corpus size (product knowledge, FAQs, policies) — not a
  massive general-web-scale corpus.

## Consequences
- Vector index choice (IVFFlat vs HNSW) and embedding dimension (`vector(1536)` pinned in
  `0001_init.sql`, matching the initially-planned embedding model) must be revisited if the embedding model
  changes — a dimension change is a breaking migration, not a config toggle.
- If corpus size or query latency/throughput needs later exceed what `pgvector` comfortably handles, this
  ADR should be revisited and superseded rather than silently working around it.

## Alternatives considered
- **Dedicated vector database** — rejected for now per the stated principle; would be reconsidered only
  with a concrete scale or feature (e.g. advanced hybrid search) justification, per master prompt §25.
