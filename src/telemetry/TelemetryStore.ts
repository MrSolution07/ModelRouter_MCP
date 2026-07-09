export class TelemetryStore {
  private recommendations: Array<{ modelId: string | null; status: string; at: string }> = [];

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
}
