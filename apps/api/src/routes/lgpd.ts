import type { FastifyInstance } from "fastify";
import { anonymizeCustomer, deleteCustomerData, exportCustomerData, getCustomerById } from "@polar/crm";
import { requirePermission } from "../plugins/auth.js";

/**
 * LGPD data-subject rights endpoints — see docs/security/security-architecture.md §7
 * and master prompt §40. All three actions require customer.delete: exporting,
 * anonymizing, and erasing personal data are equally sensitive operations, not
 * just the literal delete.
 */
export async function lgpdRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { id: string } }>(
    "/customers/:id/export",
    { preHandler: requirePermission("customer.delete") },
    async (request) => {
      await getCustomerById(request.params.id);
      return exportCustomerData(request.params.id);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/customers/:id/anonymize",
    { preHandler: requirePermission("customer.delete") },
    async (request, reply) => {
      await getCustomerById(request.params.id);
      await anonymizeCustomer(request.params.id, request.actor!);
      reply.code(204);
      return null;
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/customers/:id",
    { preHandler: requirePermission("customer.delete") },
    async (request, reply) => {
      await getCustomerById(request.params.id);
      await deleteCustomerData(request.params.id, request.actor!);
      reply.code(204);
      return null;
    },
  );
}
