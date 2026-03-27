// ─────────────────────────────────────────────
// Human-Proof · Demo Server
// ─────────────────────────────────────────────
//
// Run:  npx ts-node demo/server.ts
//
// This demo shows a simple protected voting endpoint.
// Open http://localhost:3000 in a browser to test.

import express from "express";
import { HumanProof } from "../../src/server/HumanProof.js";
import {
  createHumanProofMiddleware,
  mountChallengeEndpoint,
  mountEnrollmentEndpoints,
} from "../../src/server/middleware.js";
import { TrustTier } from "../../src/shared/types.js";

// ─── Setup ────────────────────────────────────

const app = express();
app.use(express.json());
app.use(express.static("examples/basic-vanilla/public"));

const humanProof = new HumanProof({
  rpId: "localhost",
  rpName: "Human-Proof Demo",
  challengeTtlMs: 60_000,
  minTrustTier: TrustTier.Low,  // permissive for local dev; set High in production
  enforceSignCount: true,
});

const requireHuman = createHumanProofMiddleware(humanProof, {
  onFailure: (req, res, result) => {
    res.status(403).json({
      error: "human_verification_required",
      message: result.error,
      // In production, return a fresh challenge here so the client can retry
    });
  },
});

// ─── Human-Proof endpoints ─────────────────────

mountEnrollmentEndpoints(app, humanProof);
mountChallengeEndpoint(app, humanProof);

// ─── Protected routes ─────────────────────────

// Example: human-verified vote
app.post("/api/vote", requireHuman("vote:submit"), async (req, res) => {
  const { optionId } = req.body;
  const { result, credentialId } = req.humanProof!;

  console.log(`[vote] credentialId=${credentialId} trustTier=${TrustTier[result.trustTier!]} option=${optionId}`);

  // Optional: compute humanity score before allowing high-stakes actions
  const credential = await humanProof.getCredential(credentialId);
  const score = humanProof.humanityScore({
    trustTier: result.trustTier!,
    attestationType: credential!.attestationType,
    accountAgeMs: Date.now() - credential!.createdAt,
    verificationCount: credential!.signCount,
  });

  res.json({
    success: true,
    message: `Vote recorded for option ${optionId}`,
    humanityScore: score,
    trustTier: TrustTier[result.trustTier!],
  });
});

// Example: human-verified post
app.post("/api/post", requireHuman("post:create"), async (req, res) => {
  const { content } = req.body;
  res.json({
    success: true,
    post: { id: crypto.randomUUID(), content, verifiedHuman: true },
  });
});

// Debug: list all enrolled credentials (remove in production)
app.get("/api/credentials", async (req, res) => {
  res.json(await humanProof.listCredentials());
});

// ─── Demo frontend ────────────────────────────

// Demo frontend is served via express.static("demo/public")

// ─── Start ────────────────────────────────────

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(PORT, async () => {
  console.log(`\n⬡  Human-Proof demo running at http://localhost:${PORT}\n`);
  console.log("  Enrolled credentials:", (await humanProof.listCredentials()).length);
});
