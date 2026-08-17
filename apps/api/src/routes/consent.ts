import type { FastifyInstance } from "fastify";
import { getConsentStatus, getCustomerById, grantConsent, revokeConsent } from "@polar/crm";
import { requirePermission } from "../plugins/auth.js";

/**
 * Consent endpoints — see docs/security/security-architecture.md §7 and
 * master prompt §40. Every grant/revoke is attributed to the acting admin user
 * (audit trail — packages/crm's consentService writes consent_history + audit_log).
 */
export async function consentRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>(
    "/customers/:id/consent",
    { preHandler: requirePermission("customer.read") },
    async (request) => {
      await getCustomerById(request.params.id);
      return getConsentStatus(request.params.id);
    },
  );

  app.post<{ Params: { id: string; purpose: string }; Body: { source?: string } }>(
    "/customers/:id/consent/:purpose/grant",
    { preHandler: requirePermission("customer.write") },
    async (request) => {
      await getCustomerById(request.params.id);
      await grantConsent(
        request.params.id,
        request.params.purpose,
        request.body?.source ?? "admin",
        request.actor!,
      );
      return getConsentStatus(request.params.id);
    },
  );

  app.post<{ Params: { id: string; purpose: string }; Body: { source?: string } }>(
    "/customers/:id/consent/:purpose/revoke",
    { preHandler: requirePermission("customer.write") },
    async (request) => {
      await getCustomerById(request.params.id);
      await revokeConsent(
        request.params.id,
        request.params.purpose,
        request.body?.source ?? "admin",
        request.actor!,
      );
      return getConsentStatus(request.params.id);
    },
  );
}
