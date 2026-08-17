/**
 * Knowledge document lifecycle — see docs/architecture/system-overview.md §"Knowledge"
 * and docs/data/data-model.md §knowledge. Only PUBLISHED versions are retrievable
 * by RAG (master prompt §23) — this guard is the one place that rule is enforced.
 */
export const DOCUMENT_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface RetrievableDocumentVersion {
  status: DocumentStatus;
}

export function isRetrievableForRag(version: RetrievableDocumentVersion): boolean {
  return version.status === "PUBLISHED";
}

const ALLOWED_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["DRAFT", "PUBLISHED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionDocumentStatus(from: DocumentStatus, to: DocumentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
