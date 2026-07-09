import type { PrivacyGuard } from "../../privacy/PrivacyGuard.js";

export interface SyncSourceResult {
  sourceId: string;
  syncStatus: "success" | "failed" | "skipped";
  modelsUpdated: number;
  fieldsUpdated: number;
  error: string | null;
}

export abstract class BaseAdapter {
  protected privacyGuard: PrivacyGuard;

  constructor(privacyGuard: PrivacyGuard) {
    this.privacyGuard = privacyGuard;
  }

  abstract get sourceId(): string;
  abstract sync(): SyncSourceResult;
}
