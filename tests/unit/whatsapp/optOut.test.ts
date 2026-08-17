import { describe, expect, it } from "vitest";
import { isOptOutMessage } from "@polar/whatsapp";

describe("isOptOutMessage", () => {
  it("recognizes exact opt-out keywords, case-insensitively and trimmed", () => {
    expect(isOptOutMessage("PARAR")).toBe(true);
    expect(isOptOutMessage("  sair  ")).toBe(true);
    expect(isOptOutMessage("Stop")).toBe(true);
  });

  it("does not trigger on a sentence that merely contains a keyword", () => {
    expect(isOptOutMessage("posso parar de pagar em 3x?")).toBe(false);
  });

  it("returns false for empty/undefined input", () => {
    expect(isOptOutMessage(undefined)).toBe(false);
    expect(isOptOutMessage("")).toBe(false);
  });

  it("returns false for an ordinary message", () => {
    expect(isOptOutMessage("Quero saber o preço do tênis de corrida")).toBe(false);
  });
});
