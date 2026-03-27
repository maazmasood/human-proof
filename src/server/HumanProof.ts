// ─────────────────────────────────────────────
// human-proof · Backend Core
// ─────────────────────────────────────────────
//
// Handles:
//   • Challenge generation (action-scoped, short-TTL)
//   • Attestation parsing + trust tier classification
//   • WebAuthn assertion verification
//   • Humanity scoring (optional)
//
// Zero runtime dependencies beyond Node.js built-ins.
// For production, swap the in-memory stores with your DB adapter.

import { EventEmitter } from "node:events";
import { createHash, randomBytes } from "node:crypto";
import { HumanProofError, Errors } from "../shared/errors.js";
import {
  AttestationType,
  HumanAssertion,
  HumanChallenge,
  HumanityScoreInputs,
  IHumanProofStore,
  HumanProofConfig,
  StoredCredential,
  TrustTier,
  VerificationResult,
} from "../shared/types.js";
import { MemoryStore } from "./stores/MemoryStore.js";

// ─── Helpers ──────────────────────────────────

function toBase64URL(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

function fromBase64URL(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function randomBase64URL(bytes = 32): string {
  return toBase64URL(randomBytes(bytes));
}

function now(): number {
  return Date.now();
}

// ─── Attestation → Trust Tier ─────────────────
//
// In production you'd fully parse CBOR attestation statements and
// validate their certificate chains against FIDO MDS3.
// This implementation uses the attestation format as a proxy for trust,
// which is appropriate for an MVP / validation stage.

function classifyTrustTier(attestationType: AttestationType): TrustTier {
  switch (attestationType) {
    case "apple":           // Secure Enclave (iPhone/Mac)
    case "android-key":     // StrongBox / TEE (Pixel, Samsung etc.)
      return TrustTier.High;
    case "tpm":             // Windows Hello TPM 2.0
    case "packed":          // Most FIDO2 security keys
      return TrustTier.Standard;
    case "none":
    case "self":
    default:
      return TrustTier.Low;
  }
}

// ─── clientDataJSON validation ─────────────────

interface ClientData {
  type: string;
  challenge: string;
  origin: string;
}

function parseClientData(clientDataJSON: string): ClientData {
  const decoded = fromBase64URL(clientDataJSON).toString("utf-8");
  return JSON.parse(decoded) as ClientData;
}

// ─── Signature verification ────────────────────
//
// WebAuthn signatures are over: authenticatorData || SHA-256(clientDataJSON)
// The algorithm is ECDSA P-256 (ES256, COSE alg -7) for most platform authenticators.

async function verifySignature(
  alg: number,
  publicKeyJwk: JsonWebKey,
  authenticatorData: Buffer,
  clientDataJSON: Buffer,
  signature: Buffer
): Promise<boolean> {
  try {
    const { verify, createPublicKey } = await import("node:crypto");
    
    // Create a KeyObject from the JWK
    const key = createPublicKey({ key: publicKeyJwk as any, format: "jwk" });
    
    const clientDataHash = createHash("sha256").update(clientDataJSON).digest();
    const signedData = Buffer.concat([authenticatorData, clientDataHash]);

    // Use node:crypto's verify which is more robust than WebCrypto for different formats
    // Especially handles DER vs Raw signatures for ECDSA.
    return verify(
      alg === -7 ? undefined : "sha256", // ES256 (alg -7) or RS256 (alg -257)
      signedData,
      key,
      signature
    );
  } catch (e) {
    return false;
  }
}

// ─── authenticatorData parsing ─────────────────
//
// Byte layout:
//   [0..31]  rpIdHash  (32 bytes)
//   [32]     flags     (1 byte) — bit 0 = UP (user present), bit 2 = UV (user verified)
//   [33..36] signCount (4 bytes, big-endian uint32)
//   [37..]   attested credential data (enrollment only)

interface ParsedAuthData {
  rpIdHash: Buffer;
  userPresent: boolean;
  userVerified: boolean;
  signCount: number;
}

function parseAuthenticatorData(authData: Buffer): ParsedAuthData {
  if (authData.length < 37) throw new Error("authenticatorData too short");
  const rpIdHash = authData.subarray(0, 32);
  const flags = authData[32];
  const userPresent = (flags & 0x01) !== 0;
  const userVerified = (flags & 0x04) !== 0;
  const signCount = authData.readUInt32BE(33);
  return { rpIdHash: Buffer.from(rpIdHash), userPresent, userVerified, signCount };
}

  // ─── HumanProof class ──────────────────────────
  
  export class HumanProof extends EventEmitter {
    private config: Required<HumanProofConfig>;
  
    constructor(config: HumanProofConfig) {
      super();
      this.config = {
      challengeTtlMs: 60_000,
      minTrustTier: TrustTier.Standard,
      enforceSignCount: true,
      store: new MemoryStore(),
      ...config,
    };
  }

  // ── Enrollment ────────────────────────────────

  /**
   * Step 1 of enrollment: generate PublicKeyCredentialCreationOptions
   * to send to the browser's navigator.credentials.create() call.
   */
  enrollmentOptions(userId: string, userDisplayName: string) {
    const challenge = randomBase64URL(32);

    return {
      challenge,
      rp: {
        id: this.config.rpId,
        name: this.config.rpName,
      },
      user: {
        id: toBase64URL(Buffer.from(userId, "utf-8")),
        name: userId,
        displayName: userDisplayName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256 (ECDSA P-256) — universal
        { type: "public-key", alg: -257 },  // RS256 (RSA PKCS1) — Windows Hello fallback
      ],
      authenticatorSelection: {
        // "platform" = device built-in (FaceID, fingerprint, Windows Hello)
        // Use "cross-platform" to also allow FIDO2 security keys
        authenticatorAttachment: "platform",
        userVerification: "required",        // enforce biometric/PIN
        residentKey: "preferred",
      },
      attestation: "direct",                 // request attestation for trust tier
      timeout: 60_000,
    };
  }

  /**
   * Step 2 of enrollment: verify the attestation response and store the credential.
   * Returns the stored credential or throws on invalid attestation.
   */
  async completeEnrollment(params: {
    userId: string;
    credentialId: string;
    publicKeyJwk: JsonWebKey;
    alg: number;
    attestationType: AttestationType;
    clientDataJSON: string;
    authenticatorData: string;
    challenge: string;                       // the challenge you issued in step 1
    origin: string;                          // e.g. "https://example.com"
  }): Promise<StoredCredential> {
    try {
      // 1. Verify clientData
      const clientData = parseClientData(params.clientDataJSON);
      if (clientData.type !== "webauthn.create") {
        throw Errors.Internal(`Invalid clientData.type: ${clientData.type}`);
      }

      if (clientData.challenge !== params.challenge) {
        throw Errors.ChallengeMismatch();
      }
      
      if (clientData.origin !== params.origin) {
        throw Errors.Internal(`Origin mismatch: got ${clientData.origin}`);
      }

      // 2. Verify rpIdHash and flags
      const authData = parseAuthenticatorData(fromBase64URL(params.authenticatorData));
      const expectedRpIdHash = createHash("sha256").update(this.config.rpId).digest();
      if (!authData.rpIdHash.equals(expectedRpIdHash)) {
        throw Errors.Internal("rpId hash mismatch");
      }

      if (!authData.userPresent) throw Errors.Internal("User presence flag not set");
      if (!authData.userVerified) throw Errors.Internal("User verification flag not set — biometric required");

      const trustTier = classifyTrustTier(params.attestationType);
      const credential: StoredCredential = {
        credentialId: params.credentialId,
        publicKeyJwk: params.publicKeyJwk,
        alg: params.alg,
        signCount: authData.signCount,
        trustTier,
        attestationType: params.attestationType,
        createdAt: now(),
        lastVerifiedAt: now(),
      };

      await this.config.store.saveCredential(credential);
      this.emit("enroll:success", { userId: params.userId, credentialId: credential.credentialId });
      return credential;
    } catch (e) {
      this.emit("enroll:failure", { userId: params.userId, error: e });
      throw e;
    }
  }

  // ── Verification ──────────────────────────────

  /**
   * Generate a short-lived, action-scoped challenge.
   * Call this when a user attempts a protected action.
   */
  async createChallenge(action: string): Promise<HumanChallenge> {
    const challengeId = randomBase64URL(16);
    const challenge: HumanChallenge = {
      challengeId,
      challenge: randomBase64URL(32),
      action,
      expiresAt: now() + this.config.challengeTtlMs,
    };
    await this.config.store.saveChallenge(challenge);
    return challenge;
  }

  /**
   * Verify a human assertion from the client.
   * This is the core human-proof primitive — call it before allowing any protected action.
   */
  async verify(assertion: HumanAssertion, origin: string): Promise<VerificationResult> {
    try {
      // 1. Retrieve and expire the challenge
      const stored = await this.config.store.getChallenge(assertion.challengeId);
      if (!stored) {
        throw Errors.ChallengeExpired();
      }
      await this.config.store.deleteChallenge(assertion.challengeId); // single-use
      if (now() > stored.expiresAt) {
        throw Errors.ChallengeExpired();
      }

      // 2. Retrieve stored credential
      const credential = await this.config.store.getCredential(assertion.credentialId);
      if (!credential) {
        throw Errors.CredentialNotFound();
      }

      // 3. Validate clientDataJSON
      const clientData = parseClientData(assertion.clientDataJSON);
      if (clientData.type !== "webauthn.get") {
        throw Errors.Internal(`Invalid clientData.type: ${clientData.type}`);
      }
      if (clientData.challenge !== stored.challenge) {
        throw Errors.ChallengeMismatch();
      }
      if (clientData.origin !== origin) {
        throw Errors.Internal(`Origin mismatch: expected ${origin}, got ${clientData.origin}`);
      }

      // 4. Validate rpIdHash in authenticatorData
      const authDataBuf = fromBase64URL(assertion.authenticatorData);
      const authData = parseAuthenticatorData(authDataBuf);
      const expectedRpIdHash = createHash("sha256").update(this.config.rpId).digest();
      if (!authData.rpIdHash.equals(expectedRpIdHash)) {
        throw Errors.Internal("rpId hash mismatch");
      }
      if (!authData.userPresent) {
        throw Errors.Internal("User presence not confirmed");
      }
      if (!authData.userVerified) {
        throw Errors.Internal("User verification not performed");
      }

      // 5. Verify cryptographic signature
      const sigValid = await verifySignature(
        credential.alg,
        credential.publicKeyJwk,
        authDataBuf,
        fromBase64URL(assertion.clientDataJSON),
        fromBase64URL(assertion.signature)
      );
      if (!sigValid) {
        throw Errors.SignatureInvalid();
      }

      // 6. Sign count (clone detection)
      if (this.config.enforceSignCount && authData.signCount > 0) {
        if (authData.signCount <= credential.signCount) {
          throw Errors.Internal(`Sign count regression — possible cloned authenticator (stored: ${credential.signCount}, got: ${authData.signCount})`);
        }
      }

      // 7. Trust tier policy
      if (credential.trustTier > this.config.minTrustTier) {
        return {
          isHuman: false,
          trustTier: credential.trustTier,
          error: `Trust tier ${TrustTier[credential.trustTier]} below required ${TrustTier[this.config.minTrustTier]}`,
        };
      }

      // 8. Update stored credential
      credential.signCount = authData.signCount;
      credential.lastVerifiedAt = now();
      await this.config.store.saveCredential(credential);

      const result = {
        isHuman: true,
        trustTier: credential.trustTier,
        signCount: authData.signCount,
      };

      this.emit("verify:success", { credentialId: credential.credentialId, result });
      return result;
    } catch (e) {
      this.emit("verify:failure", { credentialId: assertion.credentialId, error: e });
      throw e;
    }
  }

  // ── Humanity Score (optional) ─────────────────

  /**
   * Returns a 0–100 score based on hardware trust, attestation,
   * account age, and verification history.
   * Use this for flexible policy decisions instead of a binary gate.
   */
  humanityScore(inputs: HumanityScoreInputs): number {
    let score = 0;

    // Trust tier contributes up to 50 points
    const tierPoints: Record<TrustTier, number> = {
      [TrustTier.High]: 50,
      [TrustTier.Standard]: 30,
      [TrustTier.Low]: 10,
    };
    score += tierPoints[inputs.trustTier];

    // Attestation type contributes up to 20 points
    const attPoints: Record<AttestationType, number> = {
      apple: 20, "android-key": 20, tpm: 15, packed: 12, self: 4, none: 0,
    };
    score += attPoints[inputs.attestationType] ?? 0;

    // Account age contributes up to 20 points (capped at 90 days)
    if (inputs.accountAgeMs !== undefined) {
      const ageDays = inputs.accountAgeMs / (1000 * 60 * 60 * 24);
      score += Math.min(20, Math.floor((ageDays / 90) * 20));
    }

    // Verification history contributes up to 10 points (capped at 50 verifications)
    if (inputs.verificationCount !== undefined) {
      score += Math.min(10, Math.floor((inputs.verificationCount / 50) * 10));
    }

    return Math.min(100, score);
  }

  // ── Credential store accessors ────────────────

  async getCredential(credentialId: string): Promise<StoredCredential | undefined> {
    return this.config.store.getCredential(credentialId);
  }

  async listCredentials(): Promise<StoredCredential[]> {
    return this.config.store.listCredentials();
  }

  async revokeCredential(credentialId: string): Promise<boolean> {
    const exists = await this.config.store.getCredential(credentialId);
    if (!exists) return false;
    await this.config.store.deleteCredential(credentialId);
    return true;
  }
}
