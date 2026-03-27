// ─────────────────────────────────────────────
// Human-Proof · Browser SDK
// ─────────────────────────────────────────────
//
// Zero dependencies. Uses the browser's native WebAuthn API.
//
// Usage:
//   const sdk = new HumanProofSDK({ rpId: "example.com" });
//   await sdk.enroll({ userId: "user123", displayName: "Alice" });
//   await sdk.protectedFetch("/api/vote", { method: "POST", body: ... });

import type { HumanAssertion, HumanChallenge, StoredCredential } from "../shared/types.js";
import { HumanProofError } from "../shared/errors.js";

/** Configuration for the HumanProofSDK */
export interface SDKConfig {
  rpId: string;
  /** Base URL of your Human-Proof backend endpoints. Default: "" (same origin) */
  apiBase?: string;
  /** Path to the challenge endpoint. Default: "/human-proof/challenge" */
  challengePath?: string;
  /** Path to the enrollment (options) endpoint. Default: "/human-proof/enroll/options" */
  enrollPath?: string;
  /** Path to the enrollment (complete) endpoint. Default: "/human-proof/enroll/complete" */
  enrollCompletePath?: string;
}

export type HumanProofEvent =
  | "enroll:start"
  | "enroll:success"
  | "enroll:error"
  | "verify:start"
  | "verify:success"
  | "verify:error";

export interface EnrollOptions {
  userId: string;
  displayName?: string;
}

export interface ProtectedFetchOptions extends RequestInit {
  /** The action name to scope the challenge to. Defaults to the HTTP method + path. */
  action?: string;
}

// ─── Encoding helpers ─────────────────────────

function bufToBase64URL(buf: ArrayBuffer | BufferSource): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array((buf as ArrayBufferView).buffer);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64URLToBuf(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const binary = atob(padded);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

// ─── Credential storage ───────────────────────
// Stores the credentialId in localStorage so it persists across sessions.
// In production you may want to sync this server-side per user.

const STORAGE_KEY = "human-proof:credentialId";

function saveCredentialId(id: string): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
}

function loadCredentialId(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

// ─── HumanProofSDK ─────────────────────────────

/**
 * The client-side SDK for Human-Proof.
 * Handles enrollment and automated human-verified fetching.
 */
export class HumanProofSDK {
  private config: Required<SDKConfig>;
  private listeners: Map<HumanProofEvent, Set<Function>> = new Map();

  constructor(config: SDKConfig) {
    this.config = {
      apiBase: "",
      challengePath: "/human-proof/challenge",
      enrollPath: "/human-proof/enroll/options",
      enrollCompletePath: "/human-proof/enroll/complete",
      ...config,
    };
  }

  // ── Enrollment ─────────────────────────────

  /**
   * Enroll this device as a human-verified authenticator.
   * Triggers a biometric prompt (Face ID, fingerprint, Windows Hello, etc.)
   * 
   * Returns the credentialId on success.
   * Throws if the user cancels or the device doesn't support WebAuthn.
   */
  async enroll({ userId, displayName }: EnrollOptions): Promise<string> {
    this.assertWebAuthnSupported();

    // 1. Fetch creation options from server
    const optionsUrl = new URL(
      this.config.enrollPath,
      this.config.apiBase || location.origin
    );
    optionsUrl.searchParams.set("userId", userId);
    if (displayName) optionsUrl.searchParams.set("displayName", displayName);

    const optionsRes = await fetch(optionsUrl.toString());
    if (!optionsRes.ok) throw new Error("Failed to fetch enrollment options");
    const options = await optionsRes.json();

    // 2. Convert challenge + user.id to ArrayBuffer (WebAuthn requires this)
    const createOptions: PublicKeyCredentialCreationOptions = {
      ...options,
      challenge: base64URLToBuf(options.challenge),
      user: {
        ...options.user,
        id: base64URLToBuf(options.user.id),
      },
      excludeCredentials: (options.excludeCredentials ?? []).map((c: { id: string; type: string }) => ({
        ...c,
        id: base64URLToBuf(c.id),
      })),
    };

    // 3. Prompt the user (biometric / platform authenticator)
    const credential = await navigator.credentials.create({
      publicKey: createOptions,
    }) as PublicKeyCredential;

    const response = credential.response as AuthenticatorAttestationResponse;

    // 4. Extract public key and detect algorithm
    // In a real implementation, parse the COSE_Key from authData.
    const spki = response.getPublicKey()!;
    const { jwk, alg } = await this.parseSpki(spki);

    // 5. Detect attestation format from the attestation object
    const attestationType = this.detectAttestationType(response);

    // 6. Send to server to complete enrollment
    const completeRes = await fetch(
      this.config.apiBase + this.config.enrollCompletePath,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          credentialId: bufToBase64URL(credential.rawId),
          publicKeyJwk: jwk,
          alg,
          attestationType,
          clientDataJSON: bufToBase64URL(response.clientDataJSON),
          authenticatorData: bufToBase64URL(response.getAuthenticatorData()),
          challenge: options.challenge,
        }),
      }
    );

    if (!completeRes.ok) {
      const err = await completeRes.json().catch(() => ({}));
      this.emit("enroll:error", err);
      throw new Error(err.error ?? "Enrollment failed");
    }

    const credentialId = bufToBase64URL(credential.rawId);
    saveCredentialId(credentialId);
    this.emit("enroll:success", { credentialId });
    return credentialId;
  }

  // ── Verification ───────────────────────────

  /**
   * Prove human presence for a specific action.
   * Triggers a biometric prompt and returns a signed assertion.
   */
  async prove(action: string): Promise<HumanAssertion> {
    this.assertWebAuthnSupported();

    const credentialId = loadCredentialId();
    if (!credentialId) throw new Error("No enrolled credential found. Call enroll() first.");

    // 1. Get action-scoped challenge from server
    const challengeRes = await fetch(
      this.config.apiBase + this.config.challengePath,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }
    );
    if (!challengeRes.ok) throw new Error("Failed to get challenge");
    const humanChallenge: HumanChallenge = await challengeRes.json();

    // 2. Prompt biometric and sign the challenge
    const getOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64URLToBuf(humanChallenge.challenge),
      rpId: this.config.rpId,
      allowCredentials: [
        {
          type: "public-key",
          id: base64URLToBuf(credentialId),
        },
      ],
      userVerification: "required",
      timeout: 60_000,
    };

    const assertion = await navigator.credentials.get({
      publicKey: getOptions,
    }) as PublicKeyCredential;

    const response = assertion.response as AuthenticatorAssertionResponse;

    return {
      challengeId: humanChallenge.challengeId,
      credentialId,
      authenticatorData: bufToBase64URL(response.authenticatorData),
      clientDataJSON: bufToBase64URL(response.clientDataJSON),
      signature: bufToBase64URL(response.signature),
    };
  }

  /**
   * Drop-in replacement for fetch() that automatically attaches
   * human presence proof to the request body.
   * 
   * Example:
   *   await sdk.protectedFetch("/api/vote", {
   *     method: "POST",
   *     body: JSON.stringify({ optionId: 42 }),
   *     action: "vote:submit",
   *   });
   */
  async protectedFetch(url: string, options: ProtectedFetchOptions = {}): Promise<Response> {
    const action = options.action ?? `${(options.method ?? "GET").toLowerCase()}:${url}`;
    this.emit("verify:start", { action, url });

    try {
      const assertion = await this.prove(action);

      // Merge the assertion into the request body
      let body = options.body;
      let headers = new Headers(options.headers);

      if (headers.get("content-type")?.includes("application/json") || typeof body === "string") {
        const parsed = body ? JSON.parse(body as string) : {};
        parsed.humanProof = assertion;
        body = JSON.stringify(parsed);
        headers.set("content-type", "application/json");
      } else {
        // For non-JSON requests, fall back to headers
        headers.set("x-human-proof-challenge-id", assertion.challengeId);
        headers.set("x-human-proof-credential-id", assertion.credentialId);
        headers.set("x-human-proof-auth-data", assertion.authenticatorData);
        headers.set("x-human-proof-client-data", assertion.clientDataJSON);
        headers.set("x-human-proof-signature", assertion.signature);
      }

      const res = await fetch(url, { ...options, body, headers });
      if (res.ok) {
        this.emit("verify:success", { action, url });
      } else {
        const body = await res.clone().json().catch(() => ({}));
        this.emit("verify:error", { action, url, error: body });
      }
      return res;
    } catch (e) {
      this.emit("verify:error", { action, url, error: e });
      throw e;
    }
  }

  // ── React hook helper ──────────────────────

  /**
   * Returns a function you can use as a React onClick handler wrapper.
   * Proves human presence before invoking the handler.
   * 
   * Example:
   *   <button onClick={sdk.withHumanProof("vote:submit", handleVote)}>Vote</button>
   */
  withHumanProof<T extends unknown[]>(
    action: string,
    handler: (...args: T) => void | Promise<void>,
    onError?: (err: Error) => void
  ) {
    return async (...args: T) => {
      try {
        const assertion = await this.prove(action);
        // Inject assertion as first arg if handler expects it
        await handler(...args);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (onError) onError(error);
        else console.error("[HumanProof] Verification failed:", error);
      }
    };
  }

  // ── Utilities ──────────────────────────────

  isEnrolled(): boolean {
    return loadCredentialId() !== null;
  }

  clearEnrollment(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  static isSupported(): boolean {
    return typeof window !== "undefined" &&
      typeof window.PublicKeyCredential !== "undefined" &&
      typeof navigator.credentials?.create === "function";
  }

  private assertWebAuthnSupported(): void {
    if (!HumanProofSDK.isSupported()) {
      throw new Error(
        "WebAuthn is not supported in this browser or context. " +
        "Human-Proof requires a modern browser on HTTPS."
      );
    }
  }

  private detectAttestationType(response: AuthenticatorAttestationResponse): string {
    // Parse the attestationObject CBOR to find the fmt field.
    // Full CBOR parsing requires a library; this heuristic covers common cases.
    const buf = new Uint8Array(response.attestationObject);
    const text = new TextDecoder().decode(buf);
    if (text.includes("apple")) return "apple";
    if (text.includes("android-key")) return "android-key";
    if (text.includes("tpm")) return "tpm";
    if (text.includes("packed")) return "packed";
    if (text.includes("none")) return "none";
    return "self";
  }

  private async parseSpki(spki: ArrayBuffer): Promise<{ jwk: JsonWebKey; alg: number }> {
    // Try ECDSA P-256 first (most common for passkeys/mobile)
    try {
      const key = await crypto.subtle.importKey(
        "spki",
        spki,
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"]
      );
      return { jwk: await crypto.subtle.exportKey("jwk", key), alg: -7 };
    } catch {
      // Fallback to RSA RS256 (common for Windows Hello)
      try {
        const key = await crypto.subtle.importKey(
          "spki",
          spki,
          { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
          true,
          ["verify"]
        );
        return { jwk: await crypto.subtle.exportKey("jwk", key), alg: -257 };
      } catch (e) {
        throw new Error("Unsupported public key algorithm in authenticator");
      }
    }
  }

  /** Event Emitter interface for Browser */
  public on(event: HumanProofEvent, listener: Function): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return this;
  }

  public off(event: HumanProofEvent, listener: Function): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  private emit(event: HumanProofEvent, ...args: any[]): boolean {
    const handlers = this.listeners.get(event);
    if (!handlers) return false;
    handlers.forEach(h => h(...args));
    return true;
  }
}
