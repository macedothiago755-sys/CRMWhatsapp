# ADR-0011: Immutable internal `customer_id` as the only cross-context identity key

## Status
Accepted

## Context
Customers are reachable by phone (WhatsApp), email, and VTEX customer ID, any of which can change,
be reused, or be ambiguous (shared family phone, corporate email, etc.). Every bounded context needs a
stable way to reference "this customer."

## Decision
`crm.customer.id` (a server-generated UUID) is the only identity key any other table or package uses to
reference a customer. Phone, email, WhatsApp ID, and VTEX customer ID are all modeled as rows in
`crm.customer_identity`, many-to-one to `crm.customer`, per the matching rules in
`docs/architecture/domain-model.md` §3.

## Rationale
- Decouples identity from any single external identifier's lifecycle (a customer can change phone numbers
  without losing their history; a household can share a phone number without forcing an incorrect merge).
- Makes identity resolution and merge an explicit, auditable process (`crm.customer.merged_into_customer_id`
  + `security.audit_log`) instead of an implicit side effect of a natural-key collision.
- Matches the explicit master prompt requirement: never use phone/email as primary key (§11).

## Consequences
- Every inbound WhatsApp message requires an identity-resolution step before any other processing — this
  is on the hot path (webhook → worker) and must be fast (indexed lookup by `identity_type`+`identity_value`,
  not a scan).
- Ambiguous-match cases (two existing customers each partially match) require a manual-review workflow
  (merge candidate) rather than an automatic decision — this is a deliberate latency/safety trade for data
  integrity (master prompt §93 ranks data integrity above convenience).

## Alternatives considered
- **Use normalized phone number as the primary customer key** — rejected: does not survive number reuse/
  household sharing, and directly contradicts the master prompt's explicit identity requirement.
