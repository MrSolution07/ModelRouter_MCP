import { readFileSync } from "node:fs";
import path from "node:path";
import { atomicWriteJson } from "./atomicWrite.js";
import { getUserDataDir } from "./paths.js";

export const SYNC_TTL_MS = 24 * 60 * 60 * 1000;

export interface SyncStateSource {
  status: "success" | "failed" | "skipped";
  at: string;
}

export interface SyncState {
  lastSyncAt: string | null;
  sources: Record<string, SyncStateSource>;
}

function syncStatePath(): string {
  return path.join(getUserDataDir(), "sync-state.json");
}

export function readSyncState(): SyncState {
  try {
    return JSON.parse(readFileSync(syncStatePath(), "utf-8")) as SyncState;
  } catch {
    return { lastSyncAt: null, sources: {} };
  }
}

export function writeSyncState(state: SyncState): void {
  atomicWriteJson(syncStatePath(), state);
}

export function isSyncTtlExpired(state: SyncState, ttlMs = SYNC_TTL_MS): boolean {
  if (!state.lastSyncAt) return true;
  return Date.now() - new Date(state.lastSyncAt).getTime() > ttlMs;
}
