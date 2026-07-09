import type { PrivacyGuard } from "../privacy/PrivacyGuard.js";

export interface TelemetryEntry {
  modelId: string | null;
  status: string;
  at: string;
}

export class TelemetryStore {
  private recommendations: TelemetryEntry[] = [];

  recordRecommendation(modelId: string | null, status: string): void {
    this.recommendations.push({ modelId, status, at: new Date().toISOString() });
  }

  getSummary() {
    const byStatus: Record<string, number> = {};
    for (const r of this.recommendations) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    }
    return {
      status: "ok" as const,
      totalRecommendations: this.recommendations.length,
      byStatus,
      note: "Local telemetry only — never exported outbound",
    };
  }

  exportSummary(privacyGuard: PrivacyGuard) {
    privacyGuard.assertOutboundAllowed("E");
    return this.getSummary();
  }
}
