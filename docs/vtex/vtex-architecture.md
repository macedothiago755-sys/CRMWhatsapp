# VTEX Integration Architecture — Polar AI Commerce

## 1. Principle

VTEX remains the transactional System of Record. Polar AI Commerce does not replace, shadow-duplicate, or
race VTEX for authority over catalog, price, stock, cart, checkout, payment, or order status. Everything in
`commerce.*` is a reference or point-in-time snapshot for relationship/analytics purposes — see
[Data Architecture](../architecture/data-architecture.md) §1.

## 2. Adapter isolation

All VTEX calls live in `packages/vtex`. No other package calls a VTEX endpoint directly. Internal service
boundaries:

```text
packages/vtex/src/
  VtexCatalogService.ts     — product/SKU lookup, search
  VtexInventoryService.ts   — stock availability
  VtexPricingService.ts     — price lookup
  VtexCartService.ts        — cart create/update, mapped to commerce.cart.vtex_cart_id
  VtexCheckoutService.ts    — checkout/shipping options
  VtexOrderService.ts       — order status/tracking
```

Each service:

- has a timeout on every HTTP call;
- retries transient failures with exponential backoff, bounded;
- uses a circuit breaker where repeated VTEX failures would otherwise stack up orchestrator workers;
- is idempotent where the operation creates state (cart, checkout);
- logs every call with the shared correlation ID (see Observability Strategy);
- returns typed results/errors — a VTEX outage surfaces as a typed `VTEX_UNAVAILABLE` error the AI
  Orchestrator is instructed to handle honestly (never claim availability/price/order state without a
  fresh, successful call).

## 3. Data flow into the CRM

- `commerce.product_reference` is a lightweight local pointer (SKU/product id, name, category) — not a
  catalog duplicate. It exists so other tables (cart items, recommendations) have something stable to
  reference.
- `commerce.product_snapshot` captures price/stock at the moment it was fetched, `source='VTEX'`,
  `fetched_at` — used for analytics/recommendation ranking history, never treated as current without a
  fresh VTEX call at the point of an actual transactional action.
- `commerce.cart` mirrors a VTEX cart via `vtex_cart_id` (unique) so the CRM can track a customer's
  in-progress cart across a conversation without ever becoming a second cart authority. Cart mutation always
  round-trips to VTEX; the CRM row is a pointer + status, not the item source of truth (line items are kept
  in `cart_item` only for conversational context — e.g. "what did we just add" — the checkout still reads
  from VTEX).
- `commerce.order_reference` stores the minimum needed for the customer timeline and analytics
  (`vtex_order_id`, status, total) — not full line-item/payment detail. Sensitive payment data is never
  duplicated into Polar's database.

## 4. AI tool surface

Tools exposed to the Sales/Order agents (`search_products`, `get_product`, `compare_products`,
`check_stock`, `get_price`, `create_cart`, `get_cart`, `add_cart_item`, `remove_cart_item`,
`get_shipping_options`, `create_checkout`, `get_order`, `get_order_tracking`) each call exactly one
`packages/vtex` service method and never bypass the Business Rule Engine — e.g. `create_checkout` re-checks
stock and price against a fresh VTEX call before proceeding, it does not trust the price shown earlier in
the conversation. See [AI Architecture](../architecture/ai-architecture.md) §4.

## 5. Pending decisions

Per master prompt §76 — not to be assumed or invented:

- Which VTEX APIs/modules are enabled for this account (Catalog, Search, Checkout, OMS, etc.) and current
  API versions/endpoints — confirm against VTEX's current developer documentation before implementation,
  not from training memory (master prompt §79–80).
- VTEX credentials, environment (sandbox vs. production account), and account name.
- Whether checkout/payment can be completed inside the WhatsApp experience at all, and if so which payment
  methods VTEX + Meta jointly support today — validate technically before designing any such flow (master
  prompt §3).
- ERP integration scope, if any, sitting behind or alongside VTEX.

## 6. Phase sequencing

Per the [Development Roadmap](../architecture/roadmap.md), `packages/vtex` service *interfaces* and typed
contracts are scaffolded in Phase 0 (this delivery) so the AI tool layer (Phase 3) can be built against a
stable contract; live calls against a real VTEX account are Phase 5, gated on the pending decisions above
being resolved by the Product Owner.
