# WhatsApp Architecture — Polar AI Commerce

`packages/whatsapp` is the sole owner of all Meta WhatsApp Business Platform (Cloud API) interaction.

## 1. Scope

- Webhook verification (Meta's `hub.verify_token` challenge) and signature validation on every inbound
  request (`X-Hub-Signature-256`).
- Inbound message ingestion: text, image, audio, video, document, interactive (button/list replies),
  location, contacts, stickers.
- Outbound sends: text, template, interactive (buttons/lists), media.
- Delivery/read status webhooks.
- Template management status (approval state tracked in `campaign.template`).
- WhatsApp Flows and catalog integration — **capability-gated**: implement only once confirmed against
  current Meta documentation and Polar's approved use case (see §5, Pending Decisions).
- Opt-in / opt-out handling, wired to `consent.customer_consent` (purpose = `marketing`, at minimum;
  transactional/service messaging follows Meta's messaging-window rules regardless of marketing consent).

## 2. Message persistence

Every inbound and outbound message is persisted to `conversation.message`, with:

- `provider_message_id` — Meta's message id, the idempotency/dedupe key;
- `direction` (`inbound`/`outbound`), `message_type`, `status`;
- `body_text` for quick querying plus the full normalized `payload jsonb` (structure specific to
  `message_type` — interactive replies, media references, location, etc.);
- `sent_at` and audit timestamps.

Media (`message_attachment`) is referenced by `storage_url`, not stored inline in Postgres — the adapter
downloads from Meta's media endpoint and re-uploads to our own object storage (S3-compatible) under a
retention policy (§4), so we're never dependent on Meta's short-lived media URLs after ingestion.

## 3. Webhook flow

See [Integration Architecture](../architecture/integration-architecture.md) §3–4 for the full sequence
(verify → ack fast → enqueue → worker normalizes/persists/dedupes → hands off to AI Orchestrator). The
webhook endpoint itself does no business logic beyond verification, dedupe-key extraction, and enqueue.

## 4. Retention

Raw Meta payloads are not kept indefinitely without policy — `payload jsonb` retention follows the
platform-wide retention policy defined per data category in `docs/security/security-architecture.md` §Data
Retention, configurable per environment. Media attachments follow the same policy; expired media is purged
from object storage, with the `message_attachment` row's status reflecting the purge (not silently leaving
a dead link).

## 5. Pending decisions (do not assume — confirm with Product Owner / Meta docs before implementing)

Per master prompt §76, these are business/infrastructure decisions this repo does not invent values for:

- Meta Business Account and WhatsApp Business phone number provisioning.
- Which message types beyond text/interactive/media Polar will actually use at launch (Flows, native
  catalog) — these carry extra approval/config overhead and should not be built speculatively.
- Approved message templates (content, category, language) — subject to Meta's template review.
- Checkout-in-WhatsApp scope: **do not assume any payment method or checkout step can run natively inside
  WhatsApp.** This must be validated against Meta's and VTEX's current capabilities before any such flow is
  designed, per master prompt §3.
- 24-hour customer service messaging window handling and template fallback strategy outside that window.

## 6. Tool surface exposed to AI

The AI never calls the WhatsApp adapter directly. Message *sending* is the last step of the orchestrator's
`RESPONSE GENERATION`/`WHATSAPP` stages (deterministic code path), not an AI tool call — this prevents the
model from independently deciding to send an extra message outside the turn it's asked to respond to.
