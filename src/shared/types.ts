// ─────────────────────────────────────────────
// Human-Proof · Shared Types
// ─────────────────────────────────────────────

export type AttestationType = "packed" | "tpm" | "android-key" | "apple" | "none" | "self";

/** Hardware trust tiers – platforms set their own policy threshold */
export enum TrustTier {
  /** Modern smartphone with Secure Enclave / StrongBox */
  High = 1,
  /** Laptop with TPM 2.0 */
  Standard = 2,
  /** Unknown authenticator or virtual device */
  Low = 3,
}

/** COSE Algorithms */
export enum HumanAlg {
  ES256 = -7,
  RS256 = -257,
}

/** Stored per credential – the only data Human-Proof keeps server-side */
export interface StoredCredential {
  credentialId: string;           // base64url-encoded credential ID
  publicKeyJwk: JsonWebKey;       // COSE public key converted to JWK
  alg: number;                    // COSE algorithm identifier
  signCount: number;              // monotonic counter, used to detect clones
  trustTier: TrustTier;
  attestationType: AttestationType;
  createdAt: number;              // unix ms
  lastVerifiedAt: number;         // unix ms
}

/** What the server generates per action */
export interface HumanChallenge {
  challengeId: string;            // server-side UUID
  challenge: string;              // base64url random bytes
  action: string;                 // e.g. "post:create", "vote:submit"
  expiresAt: number;              // unix ms (short TTL, e.g. 60s)
}

/** Passed from client → server to verify human presence */
export interface HumanAssertion {
  challengeId: string;
  credentialId: string;
  authenticatorData: string;      // base64url
  clientDataJSON: string;         // base64url
  signature: string;              // base64url
}

/** Result returned by HumanProof.verify() */
export interface VerificationResult {
  isHuman: boolean;
  trustTier?: TrustTier;
  signCount?: number;
  error?: string;
}

export interface HumanityScoreInputs {
  trustTier: TrustTier;
  attestationType: AttestationType;
  accountAgeMs?: number;
  verificationCount?: number;
}

/** Interface for pluggable storage (e.g. Redis, Mongo, DB) */
export interface IHumanProofStore {
  saveChallenge(challenge: HumanChallenge): Promise<void> | void;
  getChallenge(challengeId: string): Promise<HumanChallenge | undefined> | HumanChallenge | undefined;
  deleteChallenge(challengeId: string): Promise<void> | void;

  saveCredential(credential: StoredCredential): Promise<void> | void;
  getCredential(credentialId: string): Promise<StoredCredential | undefined> | StoredCredential | undefined;
  listCredentials(): Promise<StoredCredential[]> | StoredCredential[];
  deleteCredential(credentialId: string): Promise<void> | void;
}

export interface HumanProofConfig {
  /** Your relying party ID — typically your domain, e.g. "example.com" */
  rpId: string;
  /** Display name shown in the browser's authenticator dialog */
  rpName: string;
  /** Challenge TTL in milliseconds. Default: 60_000 (1 minute) */
  challengeTtlMs?: number;
  /** Minimum trust tier required for verification. Default: TrustTier.Standard */
  minTrustTier?: TrustTier;
  /** Enable sign count validation (detects cloned authenticators). Default: true */
  enforceSignCount?: boolean;
  /** Custom storage adapter. Defaults to in-memory map. */
  store?: IHumanProofStore;
}
