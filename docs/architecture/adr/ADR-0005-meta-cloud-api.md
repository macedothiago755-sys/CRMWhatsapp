# ADR-0005: Meta WhatsApp Business Platform (Cloud API) as the messaging channel

## Status
Accepted

## Context
WhatsApp is mandated as the primary conversational channel. Meta offers the Cloud API (hosted) and an
on-premises API path (being phased out by Meta); a Business Solution Provider (BSP) is a further option.

## Decision
Integrate directly with Meta's WhatsApp Business Platform Cloud API via `packages/whatsapp`, rather than
Meta's legacy on-premises API or an initial dependency on a third-party BSP.

## Rationale
- Meta's Cloud API is the actively maintained, Meta-hosted path (the on-premises API is deprecated),
  reducing infrastructure to operate and keeping the integration on Meta's supported surface.
- Direct integration keeps message data flowing straight into Polar's own database (data ownership
  principle) without an intermediary BSP holding conversation data.

## Consequences
- Requires a Meta Business Account and a provisioned WhatsApp Business phone number — a Product Owner
  decision not yet made (`docs/whatsapp/whatsapp-architecture.md` §5).
- Template message approval, messaging-window rules, and any Flows/catalog features are subject to Meta's
  current policies — must be confirmed against live Meta documentation at implementation time (master
  prompt §79–80), not assumed.
- Checkout-in-WhatsApp capability is explicitly *not* assumed by this ADR — validated separately per
  master prompt §3 before any such flow is designed.

## Alternatives considered
- **Third-party BSP (e.g. a CPaaS layer on top of WhatsApp)** — rejected as the default: adds a
  data-sharing intermediary that works against the platform's core data-ownership principle. May be
  revisited if a specific BSP capability (e.g. faster template approval, multi-channel abstraction) proves
  necessary — would need its own ADR.
