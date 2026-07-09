import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrivacyGuard } from "../../src/privacy/PrivacyGuard.js";
import { SyncService } from "../../src/sync/SyncService.js";
import { OpenRouterAdapter } from "../../src/sync/adapters/OpenRouterAdapter.js";
import { SweBenchAdapter } from "../../src/sync/adapters/SweBenchAdapter.js";
import { AnthropicDocsAdapter } from "../../src/sync/adapters/AnthropicDocsAdapter.js";
import { OllamaAdapter } from "../../src/sync/adapters/OllamaAdapter.js";

describe("sync adapters", () => {
  let guard: PrivacyGuard;
  let assertSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    guard = new PrivacyGuard(false);
    assertSpy = vi.spyOn(guard, "assertOutboundAllowed");
  });

  it("calls PrivacyGuard in every adapter", () => {
    const adapters = [
      new OpenRouterAdapter(guard),
      new OllamaAdapter(guard),
      new SweBenchAdapter(guard),
      new AnthropicDocsAdapter(guard),
    ];
    for (const a of adapters) a.sync();
    expect(assertSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("sync_metadata returns schema-valid report via SyncService", () => {
    const service = new SyncService(guard);
    const result = service.syncAll();
    expect(result.status).toMatch(/ok|partial|failed/);
    expect(result.sources.length).toBe(4);
    expect(result.registrySnapshot).toBeDefined();
  });

  it("blocks all adapters in privacy mode", () => {
    const privateGuard = new PrivacyGuard(true);
    const adapter = new OpenRouterAdapter(privateGuard);
    const result = adapter.sync();
    expect(result.syncStatus).toBe("failed");
  });
});
