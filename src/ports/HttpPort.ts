import type { PayloadClass } from "../types/index.js";
import type { PrivacyGuard } from "../privacy/PrivacyGuard.js";

export interface HttpRequest {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  payloadClass: PayloadClass;
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  body: unknown;
}

export class HttpPort {
  private privacyGuard: PrivacyGuard;
  private fetchFn: typeof fetch;

  constructor(privacyGuard: PrivacyGuard, fetchFn: typeof fetch = globalThis.fetch) {
    this.privacyGuard = privacyGuard;
    this.fetchFn = fetchFn;
  }

  async request(req: HttpRequest): Promise<HttpResponse> {
    this.privacyGuard.assertOutboundAllowed(req.payloadClass);
    const res = await this.fetchFn(req.url, {
      method: req.method ?? "GET",
      headers: req.headers,
    });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body };
  }
}
