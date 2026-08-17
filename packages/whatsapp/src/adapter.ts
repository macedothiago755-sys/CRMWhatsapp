/**
 * WhatsApp adapter contract — see docs/whatsapp/whatsapp-architecture.md.
 * Live implementation (`MetaCloudApiAdapter`) ships in Phase 1, gated on a
 * provisioned Meta Business Account + WhatsApp number (pending decision).
 */
export interface SendTextMessageInput {
  to: string; // E.164 phone / wa_id
  body: string;
}

export interface SendTemplateMessageInput {
  to: string;
  templateName: string;
  language: string;
  components?: Record<string, unknown>[];
}

export interface SendResult {
  providerMessageId: string;
}

export interface WhatsAppAdapter {
  sendText(input: SendTextMessageInput): Promise<SendResult>;
  sendTemplate(input: SendTemplateMessageInput): Promise<SendResult>;
}
