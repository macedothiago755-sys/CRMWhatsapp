import { polarError } from "@polar/security";
import type {
  SendResult,
  SendTemplateMessageInput,
  SendTextMessageInput,
  WhatsAppAdapter,
} from "./adapter.js";

/**
 * Live Meta WhatsApp Cloud API adapter — see docs/whatsapp/whatsapp-architecture.md
 * and packages/whatsapp/src/webhookPayload.ts for the doc-verification caveat
 * (endpoint/body shape confirmed via web search, direct fetch of
 * developers.facebook.com blocked in this environment — re-verify before
 * production use).
 *
 * Endpoint: POST {graphApiBaseUrl}/{apiVersion}/{phoneNumberId}/messages
 * Every call has a timeout (master prompt §"nunca fazer chamada externa sem
 * timeout") and never claims success without a confirmed message id in the
 * response.
 */
export interface MetaCloudApiAdapterOptions {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
  graphApiBaseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface MetaSendResponse {
  messages?: { id?: string }[];
}

export class MetaCloudApiAdapter implements WhatsAppAdapter {
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly apiVersion: string;
  private readonly graphApiBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MetaCloudApiAdapterOptions) {
    this.accessToken = options.accessToken;
    this.phoneNumberId = options.phoneNumberId;
    this.apiVersion = options.apiVersion ?? "v21.0";
    this.graphApiBaseUrl = options.graphApiBaseUrl ?? "https://graph.facebook.com";
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async sendText(input: SendTextMessageInput): Promise<SendResult> {
    return this.send({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "text",
      text: { preview_url: false, body: input.body },
    });
  }

  async sendTemplate(input: SendTemplateMessageInput): Promise<SendResult> {
    return this.send({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.language },
        components: input.components,
      },
    });
  }

  private async send(body: Record<string, unknown>): Promise<SendResult> {
    const url = `${this.graphApiBaseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      throw polarError("WHATSAPP_UNAVAILABLE", `WhatsApp send request failed: ${String(err)}`);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw polarError(
        "WHATSAPP_UNAVAILABLE",
        `WhatsApp send failed with status ${response.status}: ${errorBody}`,
      );
    }

    const parsed = (await response.json()) as MetaSendResponse;
    const providerMessageId = parsed.messages?.[0]?.id;
    if (!providerMessageId) {
      // Never claim success without a confirmed id (master prompt §63 — non-hallucination).
      throw polarError("WHATSAPP_UNAVAILABLE", "WhatsApp send response did not include a message id.");
    }

    return { providerMessageId };
  }
}
