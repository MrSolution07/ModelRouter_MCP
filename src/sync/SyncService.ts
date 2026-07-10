import type { ModelRouterConfig } from "../types/index.js";
import type { PrivacyGuard } from "../privacy/PrivacyGuard.js";
import { HttpPort } from "../ports/HttpPort.js";
import { registry } from "../registry/ModelRegistry.js";
import { isSyncTtlExpired, readSyncState, writeSyncState } from "../utils/syncState.js";
import { OpenRouterAdapter } from "./adapters/OpenRouterAdapter.js";
import { OllamaAdapter } from "./adapters/OllamaAdapter.js";
import { SweBenchAdapter } from "./adapters/SweBenchAdapter.js";
import { AnthropicDocsAdapter } from "./adapters/AnthropicDocsAdapter.js";
import type { BaseAdapter } from "./adapters/BaseAdapter.js";

export interface SyncReport {
  status: "ok" | "partial" | "failed";
  sources: Awaited<ReturnType<BaseAdapter["sync"]>>[];
  staleFields: ReturnType<typeof registry.findStaleFields>;
  registrySnapshot: ReturnType<typeof registry.getSnapshot>;
  timingMs: number;
  warnings?: string[];
}

const ALL_SOURCE_IDS = ["openrouter_models", "ollama_local", "swe_bench_leaderboard", "anthropic_docs"];

export class SyncService {
  private privacyGuard: PrivacyGuard;
  private http: HttpPort;
  private adapters: BaseAdapter[];

  constructor(privacyGuard: PrivacyGuard, http?: HttpPort) {
    this.privacyGuard = privacyGuard;
    this.http = http ?? new HttpPort(privacyGuard);
    this.adapters = [
      new OpenRouterAdapter(privacyGuard, this.http),
      new OllamaAdapter(privacyGuard, this.http),
      new SweBenchAdapter(privacyGuard, this.http),
      new AnthropicDocsAdapter(privacyGuard, this.http),
    ];
  }

  getAdapters() {
    return this.adapters;
  }

  async syncAll(config?: ModelRouterConfig): Promise<SyncReport> {
    const start = Date.now();
    const enabled = config?.sync?.enabled !== false;
    const allowedSources = new Set(config?.sync?.sources ?? ALL_SOURCE_IDS);
    const warnings: string[] = [];

    const sources: SyncReport["sources"] = [];
    if (!enabled) {
      return {
        status: "partial",
        sources: [],
        staleFields: registry.findStaleFields(),
        registrySnapshot: registry.getSnapshot(),
        timingMs: Date.now() - start,
        warnings: ["SYNC_DISABLED"],
      };
    }

    for (const adapter of this.adapters) {
      if (!allowedSources.has(adapter.sourceId)) continue;
      const result = await adapter.sync();
      sources.push(result);
      if (result.syncStatus === "failed") {
        warnings.push(`SYNC_SOURCE_FAILED:${adapter.sourceId}`);
      }
    }

    registry.reload();
    const staleFields = registry.findStaleFields();
    const snapshot = registry.getSnapshot();
    const anySuccess = sources.some((s) => s.syncStatus === "success");
    const allFailed = sources.length > 0 && sources.every((s) => s.syncStatus === "failed");

    const state = readSyncState();
    state.lastSyncAt = new Date().toISOString();
    for (const s of sources) {
      state.sources[s.sourceId] = { status: s.syncStatus, at: state.lastSyncAt };
    }
    writeSyncState(state);

    return {
      status: allFailed ? "failed" : anySuccess ? "ok" : "partial",
      sources,
      staleFields,
      registrySnapshot: { ...snapshot, mode: anySuccess ? "synced" : snapshot.mode },
      timingMs: Date.now() - start,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  shouldRunBackgroundSync(config?: ModelRouterConfig): boolean {
    if (config?.privacyMode) return false;
    if (config?.sync?.enabled === false) return false;
    return isSyncTtlExpired(readSyncState());
  }
}
