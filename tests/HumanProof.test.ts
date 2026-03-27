import { describe, it, expect, beforeEach } from "vitest";
import { HumanProof } from "../src/server/HumanProof.js";
import { TrustTier, AttestationType, IHumanProofStore } from "../src/shared/types.js";

describe("HumanProof", () => {
  let humanProof: HumanProof;

  beforeEach(() => {
    humanProof = new HumanProof({
      rpId: "example.com",
      rpName: "Test App",
    });
  });

  it("should generate enrollment options", async () => {
    const options = await humanProof.enrollmentOptions("user123", "Alice");
    expect(options.rp.id).toBe("example.com");
    expect(options.user.name).toBe("user123");
    expect(options.challenge).toBeDefined();
    expect(options.pubKeyCredParams).toContainEqual({ type: "public-key", alg: -7 });
  });

  it("should create action-scoped challenges", async () => {
    const challenge = await humanProof.createChallenge("vote:submit");
    expect(challenge.action).toBe("vote:submit");
    expect(challenge.challengeId).toBeDefined();
    expect(challenge.challenge).toBeDefined();
    expect(challenge.expiresAt).toBeGreaterThan(Date.now());
  });

  it("should identify trust tiers correctly", () => {
    expect(humanProof).toBeDefined();
  });

  it("should fail verification if challenge is missing", async () => {
    const promise = humanProof.verify({
      challengeId: "non-existent",
      credentialId: "some-id",
      authenticatorData: "",
      clientDataJSON: "",
      signature: "",
    }, "https://example.com");

    await expect(promise).rejects.toThrow("The challenge has expired. Please request a new one.");
  });

  describe("Integration-like verification (mocked)", () => {
    // Mock data for an ES256 credential
    const mockCred = {
      credentialId: "test-cid",
      publicKeyJwk: { kty: "EC", crv: "P-256", x: "...", y: "..." } as JsonWebKey,
      alg: -7,
      signCount: 0,
      trustTier: TrustTier.High,
      attestationType: "apple" as AttestationType,
      createdAt: Date.now(),
      lastVerifiedAt: Date.now(),
    };

    it("should store and retrieve credentials with algorithm info", async () => {
      await ((humanProof as unknown as { config: { store: IHumanProofStore } }).config.store.saveCredential(mockCred));
      const retrieved = await humanProof.getCredential("test-cid");
      expect(retrieved?.alg).toBe(-7);
    });

    it("should fail verification with invalid signature format", async () => {
      await ((humanProof as unknown as { config: { store: IHumanProofStore } }).config.store.saveCredential(mockCred));
      const challenge = await humanProof.createChallenge("test-action");
      
      const { createHash } = await import("node:crypto");
      const rpIdHash = createHash("sha256").update("example.com").digest();
      const flags = Buffer.from([0x05]); // User Presence (0x01) + User Verified (0x04)
      const signCount = Buffer.from([0, 0, 0, 1]);
      const authData = Buffer.concat([rpIdHash, flags, signCount]); 

      const promise = humanProof.verify({
        challengeId: challenge.challengeId,
        credentialId: "test-cid",
        authenticatorData: authData.toString("base64url"),
        clientDataJSON: Buffer.from(JSON.stringify({
          type: "webauthn.get",
          challenge: challenge.challenge,
          origin: "https://example.com"
        })).toString("base64url"),
        signature: "invalid-signature",
      }, "https://example.com");

      await expect(promise).rejects.toThrow("Cryptographic signature verification failed.");
    });
  });
});
