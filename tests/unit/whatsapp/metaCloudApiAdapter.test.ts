import { describe, expect, it, vi } from "vitest";
import { MetaCloudApiAdapter } from "@polar/whatsapp";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("MetaCloudApiAdapter", () => {
  it("sends a text message with the expected URL, headers, and body shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { messages: [{ id: "wamid.OUT1" }] }));
    const adapter = new MetaCloudApiAdapter({
      accessToken: "test-token",
      phoneNumberId: "pn-1",
      apiVersion: "v21.0",
      graphApiBaseUrl: "https://graph.example.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await adapter.sendText({ to: "+5511988887777", body: "Olá!" });

    expect(result).toEqual({ providerMessageId: "wamid.OUT1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.example.test/v21.0/pn-1/messages");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+5511988887777",
      type: "text",
      text: { preview_url: false, body: "Olá!" },
    });
  });

  it("sends a template message with the expected body shape", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { messages: [{ id: "wamid.OUT2" }] }));
    const adapter = new MetaCloudApiAdapter({
      accessToken: "test-token",
      phoneNumberId: "pn-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await adapter.sendTemplate({
      to: "+5511988887777",
      templateName: "order_confirmation",
      language: "pt_BR",
      components: [{ type: "body", parameters: [{ type: "text", text: "12345" }] }],
    });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+5511988887777",
      type: "template",
      template: {
        name: "order_confirmation",
        language: { code: "pt_BR" },
        components: [{ type: "body", parameters: [{ type: "text", text: "12345" }] }],
      },
    });
  });

  it("throws WHATSAPP_UNAVAILABLE on a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, { error: { message: "Invalid token" } }));
    const adapter = new MetaCloudApiAdapter({
      accessToken: "bad-token",
      phoneNumberId: "pn-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(adapter.sendText({ to: "+5511988887777", body: "hi" })).rejects.toMatchObject({
      code: "WHATSAPP_UNAVAILABLE",
    });
  });

  it("throws WHATSAPP_UNAVAILABLE if the response is missing a message id (never claim success without confirmation)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { messages: [] }));
    const adapter = new MetaCloudApiAdapter({
      accessToken: "test-token",
      phoneNumberId: "pn-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(adapter.sendText({ to: "+5511988887777", body: "hi" })).rejects.toMatchObject({
      code: "WHATSAPP_UNAVAILABLE",
    });
  });

  it("throws WHATSAPP_UNAVAILABLE when the network request itself fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const adapter = new MetaCloudApiAdapter({
      accessToken: "test-token",
      phoneNumberId: "pn-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(adapter.sendText({ to: "+5511988887777", body: "hi" })).rejects.toMatchObject({
      code: "WHATSAPP_UNAVAILABLE",
    });
  });
});
