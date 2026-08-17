/**
 * Customer preference types — see docs/architecture/domain-model.md §4.
 * Never a single free-text memory blob: structured attribute/value with lineage.
 */
export type PreferenceSource = "explicit" | "inferred" | "imported";

export interface CustomerPreferenceInput {
  customerId: string;
  attribute: string;
  value: string;
  source: PreferenceSource;
  /** Required when source === 'inferred' — see docs/data/data-model.md §crm. */
  confidence?: number;
  sourceConversationId?: string;
  sourceMessageId?: string;
  expiresAt?: Date;
}

export function validatePreferenceInput(input: CustomerPreferenceInput): void {
  if (input.source === "inferred" && input.confidence === undefined) {
    throw new Error(
      `Inferred preference for attribute "${input.attribute}" must carry a confidence score (docs/architecture/domain-model.md §4).`,
    );
  }
  if (input.confidence !== undefined && (input.confidence < 0 || input.confidence > 1)) {
    throw new Error(`Preference confidence must be between 0 and 1, got ${input.confidence}.`);
  }
}
