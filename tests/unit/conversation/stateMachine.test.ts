import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, getAllowedTransitions, isTerminal } from "@polar/conversation";

describe("conversation state machine", () => {
  it("allows the happy-path progression", () => {
    expect(canTransition("NEW", "ACTIVE")).toBe(true);
    expect(canTransition("ACTIVE", "QUALIFYING")).toBe(true);
    expect(canTransition("QUALIFYING", "RECOMMENDING")).toBe(true);
    expect(canTransition("RECOMMENDING", "PURCHASING")).toBe(true);
    expect(canTransition("PURCHASING", "CHECKOUT")).toBe(true);
    expect(canTransition("CHECKOUT", "POST_PURCHASE")).toBe(true);
    expect(canTransition("POST_PURCHASE", "RESOLVED")).toBe(true);
  });

  it("rejects skipping states out of order", () => {
    expect(canTransition("NEW", "CHECKOUT")).toBe(false);
  });

  it("allows escalation from any non-terminal state", () => {
    expect(canTransition("QUALIFYING", "ESCALATED")).toBe(true);
    expect(canTransition("PURCHASING", "BLOCKED")).toBe(true);
  });

  it("has no outgoing transitions from a terminal state", () => {
    expect(isTerminal("RESOLVED")).toBe(true);
    expect(getAllowedTransitions("RESOLVED")).toEqual([]);
    expect(canTransition("RESOLVED", "ACTIVE")).toBe(false);
  });

  it("throws on an invalid transition", () => {
    expect(() => assertTransition("NEW", "CHECKOUT")).toThrow();
  });
});
