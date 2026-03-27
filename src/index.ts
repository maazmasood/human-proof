// ─────────────────────────────────────────────
// human-proof · Main Entry Point
// ─────────────────────────────────────────────

export * from "./shared/types.js";
export * from "./shared/errors.js";

// Server-side
export { HumanProof } from "./server/HumanProof.js";
export {
  createHumanProofMiddleware,
  mountChallengeEndpoint,
  mountEnrollmentEndpoints,
} from "./server/middleware.js";
export { RedisStore } from "./server/adapters/RedisStore.js";
export { PrismaStore } from "./server/adapters/PrismaStore.js";

// Client-side (SDK)
export { HumanProofSDK } from "./sdk/HumanProofSDK.js";
export type {
  SDKConfig,
  EnrollOptions,
  ProtectedFetchOptions,
  HumanProofEvent,
} from "./sdk/HumanProofSDK.js";

// Frameworks
export * from "./sdk/react.js";
