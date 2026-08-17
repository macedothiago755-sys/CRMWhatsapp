import { describe, expect, it } from "vitest";
import { canTransitionDocumentStatus, isRetrievableForRag } from "@polar/knowledge";

describe("isRetrievableForRag", () => {
  it("only PUBLISHED documents are retrievable", () => {
    expect(isRetrievableForRag({ status: "PUBLISHED" })).toBe(true);
    expect(isRetrievableForRag({ status: "DRAFT" })).toBe(false);
    expect(isRetrievableForRag({ status: "REVIEW" })).toBe(false);
    expect(isRetrievableForRag({ status: "ARCHIVED" })).toBe(false);
  });
});

describe("canTransitionDocumentStatus", () => {
  it("allows the standard lifecycle", () => {
    expect(canTransitionDocumentStatus("DRAFT", "REVIEW")).toBe(true);
    expect(canTransitionDocumentStatus("REVIEW", "PUBLISHED")).toBe(true);
    expect(canTransitionDocumentStatus("PUBLISHED", "ARCHIVED")).toBe(true);
  });

  it("rejects publishing directly from draft", () => {
    expect(canTransitionDocumentStatus("DRAFT", "PUBLISHED")).toBe(false);
  });

  it("has no outgoing transitions from ARCHIVED", () => {
    expect(canTransitionDocumentStatus("ARCHIVED", "DRAFT")).toBe(false);
  });
});
