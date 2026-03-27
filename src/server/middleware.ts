// ─────────────────────────────────────────────
// human-proof · Express Middleware
// ─────────────────────────────────────────────
//
// Usage:
//   import { createHumanProofMiddleware } from "./middleware.js";
//
//   import { createHumanProofMiddleware } from "./middleware.js";
//
//   const humanProof = new HumanProof({ rpId: "example.com", rpName: "My App" });
//   const requireHuman = createHumanProofMiddleware(humanProof);
//
//   app.post("/api/vote", requireHuman("vote:submit"), (req, res) => { ... });

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { HumanProof } from "./HumanProof.js";
import { HumanProofError } from "../shared/errors.js";
import { HumanAssertion, VerificationResult, TrustTier } from "../shared/types.js";

// Augment Express Request so downstream handlers can read verification results
declare global {
  namespace Express {
    interface Request {
      humanProof?: {
        result: VerificationResult;
        credentialId: string;
      };
    }
  }
}

export interface MiddlewareOptions {
  /** Extract origin from request — defaults to req.headers.origin */
  getOrigin?: (req: Request) => string;
  /** Called when verification fails — defaults to 403 JSON response */
  onFailure?: (req: Request, res: Response, result: VerificationResult) => void;
}

/**
 * Creates an Express middleware factory.
 * 
 * Each call returns a middleware scoped to a specific action,
 * so challenge/assertion pairs are action-bound and cannot be replayed
 * across different protected routes.
 */
export function createHumanProofMiddleware(
  humanProof: HumanProof,
  options: MiddlewareOptions = {}
) {
  const getOrigin = options.getOrigin ?? ((req) => {
    const origin = req.headers.origin;
    if (!origin) throw new Error("Missing Origin header");
    return origin;
  });

  const onFailure = options.onFailure ?? ((req, res, result) => {
    res.status(403).json({
      error: "human_verification_required",
      message: result.error ?? "Human presence verification failed",
      isHuman: false,
    });
  });

  /**
   * Returns middleware that verifies human presence for the given action.
   * 
   * Expects the request body (or headers) to contain:
   *   - x-human-proof-challenge-id  (header) or body.humanProof.challengeId
   *   - x-human-proof-credential-id (header) or body.humanProof.credentialId  
   *   - x-human-proof-auth-data     (header) or body.humanProof.authenticatorData
   *   - x-human-proof-client-data   (header) or body.humanProof.clientDataJSON
   *   - x-human-proof-signature     (header) or body.humanProof.signature
   */
  return function requireHuman(action: string): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const assertion = extractAssertion(req);
        if (!assertion) {
          return onFailure(req, res, {
            isHuman: false,
            error: "Missing human verification data. Include humanProof fields in the request body.",
          });
        }

        const origin = getOrigin(req);
        const result = await humanProof.verify(assertion, origin);

        if (!result.isHuman) {
          return onFailure(req, res, result);
        }

        req.humanProof = {
          result,
          credentialId: assertion.credentialId,
        };

        next();
      } catch (err) {
        if (err instanceof HumanProofError) {
          return res.status(err.statusCode).json(err.toJSON());
        }
        const message = err instanceof Error ? err.message : "Internal Server Error";
        res.status(500).json({ success: false, error: "HP_INTERNAL_ERROR", message });
      }
    };
  };
}

function extractAssertion(req: Request): HumanAssertion | null {
  // Try body first (JSON API pattern)
  if (req.body?.HumanProof) {
    const h = req.body.HumanProof;
    if (h.challengeId && h.credentialId && h.authenticatorData && h.clientDataJSON && h.signature) {
      return {
        challengeId: h.challengeId,
        credentialId: h.credentialId,
        authenticatorData: h.authenticatorData,
        clientDataJSON: h.clientDataJSON,
        signature: h.signature,
      };
    }
  }

  // Fall back to headers (useful for non-JSON payloads)
  const challengeId = req.headers["x-human-proof-challenge-id"] as string;
  const credentialId = req.headers["x-human-proof-credential-id"] as string;
  const authenticatorData = req.headers["x-human-proof-auth-data"] as string;
  const clientDataJSON = req.headers["x-human-proof-client-data"] as string;
  const signature = req.headers["x-human-proof-signature"] as string;

  if (challengeId && credentialId && authenticatorData && clientDataJSON && signature) {
    return { challengeId, credentialId, authenticatorData, clientDataJSON, signature };
  }

  return null;
}

// ─── Route helpers ────────────────────────────

/**
 * Adds the challenge-issuance endpoint to your Express app.
 * 
 * POST /human-proof/challenge
 * Body: { action: string }
 * Returns: HumanChallenge
 */
export function mountChallengeEndpoint(app: { post: Function }, humanProof: HumanProof, path = "/human-proof/challenge") {
  app.post(path, async (req: Request, res: Response) => {
    const action = req.body?.action;
    if (!action || typeof action !== "string") {
      return res.status(400).json({ error: "action is required" });
    }
    const challenge = await humanProof.createChallenge(action);
    res.json(challenge);
  });
}

/**
 * Adds the enrollment endpoints to your Express app.
 * 
 * GET  /human-proof/enroll/options?userId=...
 * POST /human-proof/enroll/complete
 */
export function mountEnrollmentEndpoints(app: { get: Function; post: Function }, humanProof: HumanProof, basePath = "/human-proof") {
  app.get(`${basePath}/enroll/options`, async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    const displayName = (req.query.displayName as string) || userId;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    res.json(await humanProof.enrollmentOptions(userId, displayName));
  });

  app.post(`${basePath}/enroll/complete`, async (req: Request, res: Response) => {
    try {
      const credential = await humanProof.completeEnrollment({
        ...req.body,
        origin: req.headers.origin as string,
      });
      res.json({
        success: true,
        credentialId: credential.credentialId,
        trustTier: credential.trustTier,
        attestationType: credential.attestationType,
      });
    } catch (err) {
      if (err instanceof HumanProofError) {
          return res.status(err.statusCode).json(err.toJSON());
        }
        const message = err instanceof Error ? err.message : "Enrollment failed";
        res.status(500).json({ success: false, error: "HP_INTERNAL_ERROR", message });
    }
  });
}
