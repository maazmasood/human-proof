import { HumanProof, RedisStore } from "../../../src/index.js";

// Professional multi-node setup example:
// import { HumanProof } from "../../../src/server/HumanProof.js";

/**
 * Global instance for the Next.js app.
 */
export const HumanProofInstance = new HumanProof({
  rpId: process.env.NEXT_PUBLIC_RP_ID || "localhost",
  rpName: "Human-Proof Next.js Demo",
});
//   store: new RedisStore(redis)
// });
