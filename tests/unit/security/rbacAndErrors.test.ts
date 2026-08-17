import { describe, expect, it } from "vitest";
import { hasPermission, polarError, requirePermission, type AuthenticatedActor } from "@polar/security";

const actor: AuthenticatedActor = {
  userId: "user-1",
  roles: ["CUSTOMER_SERVICE"],
  permissions: ["conversation.read", "conversation.manage"],
};

describe("RBAC", () => {
  it("hasPermission reflects the actor's granted permissions", () => {
    expect(hasPermission(actor, "conversation.read")).toBe(true);
    expect(hasPermission(actor, "campaign.send")).toBe(false);
  });

  it("requirePermission throws a FORBIDDEN PolarError when denied", () => {
    expect(() => requirePermission(actor, "campaign.send")).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("requirePermission does not throw when granted", () => {
    expect(() => requirePermission(actor, "conversation.read")).not.toThrow();
  });
});

describe("polarError", () => {
  it("maps error codes to the expected HTTP status", () => {
    expect(polarError("CUSTOMER_NOT_FOUND", "not found").statusCode).toBe(404);
    expect(polarError("UNAUTHORIZED", "no auth").statusCode).toBe(401);
    expect(polarError("RATE_LIMITED", "too many").statusCode).toBe(429);
  });

  it("never leaks internals in toJSON", () => {
    const err = polarError("INTERNAL_ERROR", "boom", { secret: "should-not-appear" });
    expect(err.toJSON()).toEqual({ code: "INTERNAL_ERROR", message: "boom" });
  });
});
