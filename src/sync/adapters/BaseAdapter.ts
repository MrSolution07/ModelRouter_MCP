import type { PrivacyGuard } from "../../privacy/PrivacyGuard.js";
import type { HttpPort } from "../../ports/HttpPort.js";

export interface SyncSourceResult {
  sourceId: string;
  syncStatus: "success" | "failed" | "skipped";
  modelsUpdated: number;
  fieldsUpdated: number;
  error: string | null;
}

export abstract class BaseAdapter {
  protected privacyGuard: PrivacyGuard;
  protected http: HttpPort;

  constructor(privacyGuard: PrivacyGuard, http: HttpPort) {
    this.privacyGuard = privacyGuard;
    this.http = http;
  }

  abstract get sourceId(): string;
  abstract sync(): Promise<SyncSourceResult>;
}
