import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrivacyGuard } from "../../src/privacy/PrivacyGuard.js";
import { SyncService } from "../../src/sync/SyncService.js";
import { OpenRouterAdapter } from "../../src/sync/adapters/OpenRouterAdapter.js";
import { SweBenchAdapter } from "../../src/sync/adapters/SweBenchAdapter.js";
import { AnthropicDocsAdapter } from "../../src/sync/adapters/AnthropicDocsAdapter.js";
import { OllamaAdapter } from "../../src/sync/adapters/OllamaAdapter.js";
import type { HttpPort } from "../../src/ports/HttpPort.js";

describe("sync adapters", () => {
  let guard: PrivacyGuard;
  let assertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    guard = new PrivacyGuard(false);
    assertSpy = vi.spyOn(guard, "assertOutboundAllowed");
  });

  it("calls PrivacyGuard in every adapter", async () => {
    const mockHttp = { request: vi.fn() } as unknown as HttpPort;
    const adapters = [
      new OpenRouterAdapter(guard, mockHttp),
      new OllamaAdapter(guard, mockHttp),
      new SweBenchAdapter(guard, mockHttp),
      new AnthropicDocsAdapter(guard, mockHttp),
    ];
    for (const a of adapters) await a.sync();
    expect(assertSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("sync_metadata returns schema-valid report via SyncService", async () => {
    const service = new SyncService(guard);
    const result = await service.syncAll();
    expect(result.status).toMatch(/ok|partial|failed/);
    expect(result.sources.length).toBe(4);
    expect(result.registrySnapshot).toBeDefined();
  });

  it("blocks all adapters in privacy mode", async () => {
    const privateGuard = new PrivacyGuard(true);
    const mockHttp = { request: vi.fn() } as unknown as HttpPort;
    const adapter = new OpenRouterAdapter(privateGuard, mockHttp);
    const result = await adapter.sync();
    expect(result.syncStatus).toBe("failed");
  });
});

describe("live HttpPort (mocked)", () => {
  it("OpenRouter uses HttpPort when fixtures disabled", async () => {
    const prev = process.env.MODELROUTER_USE_FIXTURES;
    delete process.env.MODELROUTER_USE_FIXTURES;

    const guard = new PrivacyGuard(false);
    const request = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: { data: [{ id: "anthropic/claude-sonnet", pricing: { prompt: "0.000003", completion: "0.000015" } }] },
    });
    const http = { request } as unknown as HttpPort;
    const adapter = new OpenRouterAdapter(guard, http);
    const result = await adapter.sync();
    expect(request).toHaveBeenCalled();
    expect(result.syncStatus).toBe("success");

    process.env.MODELROUTER_USE_FIXTURES = prev ?? "1";
  });

  it("Ollama returns skipped when unreachable", async () => {
    const prev = process.env.MODELROUTER_USE_FIXTURES;
    delete process.env.MODELROUTER_USE_FIXTURES;

    const guard = new PrivacyGuard(false);
    const request = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const http = { request } as unknown as HttpPort;
    const adapter = new OllamaAdapter(guard, http);
    const result = await adapter.sync();
    expect(result.syncStatus).toBe("skipped");

    process.env.MODELROUTER_USE_FIXTURES = prev ?? "1";
  });
});
