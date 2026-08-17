import type { FastifyInstance } from "fastify";
import {
  appendTimelineEvent,
  createCustomer,
  getCurrentPreferences,
  getCustomerById,
  getTimeline,
  resolveOrCreateCustomer,
  setPreference,
  upsertProfile,
  upsertSportProfile,
  type IdentityInput,
  type ProfileInput,
  type SportProfileInput,
} from "@polar/crm";
import { polarError } from "@polar/security";
import { requirePermission } from "../plugins/auth.js";

/**
 * Customer / identity endpoints — see docs/architecture/domain-model.md and
 * docs/security/security-architecture.md §2 for the permissions enforced below.
 */
export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { identities: IdentityInput[] } }>(
    "/customers",
    { preHandler: requirePermission("customer.write") },
    async (request, reply) => {
      const { identities } = request.body ?? { identities: [] };
      if (!identities || identities.length === 0) {
        throw polarError("VALIDATION_ERROR", "At least one identity is required.");
      }
      const customer = await createCustomer(identities);
      await appendTimelineEvent({
        customerId: customer.id,
        eventType: "customer.created",
        title: "Customer created",
      });
      reply.code(201);
      return customer;
    },
  );

  app.post<{ Body: { identities: IdentityInput[] } }>(
    "/identities/resolve",
    { preHandler: requirePermission("customer.write") },
    async (request) => {
      const { identities } = request.body ?? { identities: [] };
      if (!identities || identities.length === 0) {
        throw polarError("VALIDATION_ERROR", "At least one identity is required.");
      }
      return resolveOrCreateCustomer(identities);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/customers/:id",
    { preHandler: requirePermission("customer.read") },
    async (request) => {
      return getCustomerById(request.params.id);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/customers/:id/timeline",
    { preHandler: requirePermission("customer.read") },
    async (request) => {
      await getCustomerById(request.params.id); // 404s if unknown
      return getTimeline(request.params.id);
    },
  );

  app.put<{ Params: { id: string }; Body: ProfileInput }>(
    "/customers/:id/profile",
    { preHandler: requirePermission("customer.write") },
    async (request) => {
      await getCustomerById(request.params.id);
      return upsertProfile(request.params.id, request.body);
    },
  );

  app.put<{ Params: { id: string }; Body: SportProfileInput }>(
    "/customers/:id/sport-profile",
    { preHandler: requirePermission("customer.write") },
    async (request) => {
      await getCustomerById(request.params.id);
      return upsertSportProfile(request.params.id, request.body);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/customers/:id/preferences",
    { preHandler: requirePermission("customer.read") },
    async (request) => {
      await getCustomerById(request.params.id);
      return getCurrentPreferences(request.params.id);
    },
  );

  app.post<{
    Params: { id: string };
    Body: { attribute: string; value: string; source: "explicit" | "inferred" | "imported"; confidence?: number };
  }>("/customers/:id/preferences", { preHandler: requirePermission("customer.write") }, async (request) => {
    await getCustomerById(request.params.id);
    return setPreference({ customerId: request.params.id, ...request.body });
  });
}
