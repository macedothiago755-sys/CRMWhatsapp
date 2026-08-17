import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySubscriptionChallenge, verifyWebhookSignature } from "@polar/whatsapp";

const APP_SECRET = "test-app-secret";

function sign(body: string): string {
  return `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(verifyWebhookSignature(body, sign(body), APP_SECRET)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const body = JSON.stringify({ hello: "world" });
    const signature = sign(body);
    expect(verifyWebhookSignature(JSON.stringify({ hello: "mallory" }), signature, APP_SECRET)).toBe(
      false,
    );
  });

  it("rejects a missing signature header", () => {
    expect(verifyWebhookSignature("body", undefined, APP_SECRET)).toBe(false);
  });

  it("rejects a malformed signature header", () => {
    expect(verifyWebhookSignature("body", "not-a-real-signature", APP_SECRET)).toBe(false);
  });
});

describe("verifySubscriptionChallenge", () => {
  it("returns the challenge when mode and token match", () => {
    expect(verifySubscriptionChallenge("subscribe", "expected-token", "1234", "expected-token")).toBe(
      "1234",
    );
  });

  it("returns null when the token does not match", () => {
    expect(verifySubscriptionChallenge("subscribe", "wrong-token", "1234", "expected-token")).toBeNull();
  });

  it("returns null when mode is not subscribe", () => {
    expect(verifySubscriptionChallenge("unsubscribe", "expected-token", "1234", "expected-token")).toBeNull();
  });
});
