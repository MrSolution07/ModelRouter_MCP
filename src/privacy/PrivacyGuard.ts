import type { PayloadClass } from "../types/index.js";

const FORBIDDEN_OUTBOUND: PayloadClass[] = ["A", "B", "C"];

export class PrivacyGuard {
  private privacyMode: boolean;

  constructor(privacyMode = false) {
    this.privacyMode = privacyMode;
  }

  setPrivacyMode(enabled: boolean): void {
    this.privacyMode = enabled;
  }

  isPrivacyMode(): boolean {
    return this.privacyMode;
  }

  assertOutboundAllowed(payloadClass: PayloadClass): void {
    if (this.privacyMode) {
      throw new PrivacyBlockedError("Outbound requests blocked in privacy mode");
    }
    if (FORBIDDEN_OUTBOUND.includes(payloadClass)) {
      throw new PrivacyBlockedError(`Payload class ${payloadClass} must never leave the machine`);
    }
  }

  assertClassAllowedOutbound(payloadClass: PayloadClass): boolean {
    return !this.privacyMode && !FORBIDDEN_OUTBOUND.includes(payloadClass);
  }
}

export class PrivacyBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivacyBlockedError";
  }
}
