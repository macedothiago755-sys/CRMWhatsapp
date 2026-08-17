/**
 * VTEX service contracts — see docs/vtex/vtex-architecture.md §2.
 * Live implementations ship in Phase 5, gated on VTEX credentials/account scope
 * (pending decision) and on confirming current endpoints against VTEX's official
 * developer documentation (never assumed from memory — docs/vtex/vtex-architecture.md §5).
 *
 * Every method here is expected, once implemented, to carry a timeout, bounded
 * retry with backoff, and structured logging with the shared correlation id
 * (docs/architecture/integration-architecture.md §2).
 */

export interface VtexProduct {
  vtexProductId: string;
  vtexSkuId: string;
  name: string;
  category: string | undefined;
}

export interface VtexCatalogService {
  searchProducts(query: string): Promise<VtexProduct[]>;
  getProduct(vtexSkuId: string): Promise<VtexProduct | null>;
}

export interface VtexStock {
  skuId: string;
  available: boolean;
  quantity: number | null;
}

export interface VtexInventoryService {
  checkStock(vtexSkuId: string): Promise<VtexStock>;
}

export interface VtexPrice {
  skuId: string;
  price: number;
  currency: string;
}

export interface VtexPricingService {
  getPrice(vtexSkuId: string): Promise<VtexPrice>;
}

export interface VtexCart {
  vtexCartId: string;
  items: { skuId: string; quantity: number }[];
}

export interface VtexCartService {
  createCart(): Promise<VtexCart>;
  getCart(vtexCartId: string): Promise<VtexCart>;
  addItem(vtexCartId: string, skuId: string, quantity: number): Promise<VtexCart>;
  removeItem(vtexCartId: string, skuId: string): Promise<VtexCart>;
}

export interface VtexShippingOption {
  id: string;
  label: string;
  price: number;
  estimatedDays: number;
}

export interface VtexCheckoutService {
  getShippingOptions(vtexCartId: string, postalCode: string): Promise<VtexShippingOption[]>;
  createCheckout(vtexCartId: string): Promise<{ checkoutUrl: string }>;
}

export interface VtexOrder {
  vtexOrderId: string;
  status: string;
  total: number;
  currency: string;
}

export interface VtexOrderService {
  getOrder(vtexOrderId: string): Promise<VtexOrder>;
  getOrderTracking(vtexOrderId: string): Promise<{ status: string; events: unknown[] }>;
}
