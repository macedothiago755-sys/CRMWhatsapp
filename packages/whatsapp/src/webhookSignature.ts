import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta WhatsApp Cloud API webhook signature verification.
 * Meta signs each webhook payload with the app secret via `X-Hub-Signature-256:
 * sha256=<hex>`. Confirm the exact header/algorithm against current Meta docs
 * before relying on this in production (docs/architecture/integration-architecture.md §2).
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expectedHex = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const providedHex = signatureHeader.slice("sha256=".length);

  const expected = Buffer.from(expectedHex, "hex");
  const provided = Buffer.from(providedHex, "hex");

  if (expected.length !== provided.length) {
    return false;
  }
  return timingSafeEqual(expected, provided);
}

/** Meta's webhook subscription verification handshake (GET request challenge). */
export function verifySubscriptionChallenge(
  mode: string | undefined,
  token: string | undefined,
  challenge: string | undefined,
  expectedVerifyToken: string,
): string | null {
  if (mode === "subscribe" && token === expectedVerifyToken && challenge) {
    return challenge;
  }
  return null;
}
