<p align="center">
  <img src="Public/human-proof-logo.png" style="border-radius: 20%; background-color: white;" alt="Human-Proof Logo" width="200" />
</p>

# ⬡ Human-Proof

[![CI](https://github.com/maazmasood/human-proof/actions/workflows/ci.yml/badge.svg)](https://github.com/maazmasood/human-proof/actions)
[![npm version](https://img.shields.io/npm/v/human-proof.svg)](https://www.npmjs.com/package/human-proof)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Privacy-First Protocol for Hardware-Verified Human Liveness**

Human-Proof is an open-source protocol and SDK designed to solve the problem of automated bot abuse (sybil attacks, spam, voting manipulation) by shifting the security perimeter from **Identity** to **Physical Presence**. 

By leveraging native **WebAuthn (FIDO2)** capabilities, Human-Proof generates cryptographic proofs that an action was performed by a human physically interacting with a hardware Root of Trust (Secure Enclave, TPM), without ever collecting biometrics or PII.

---

## ⚡ Key Features

- **Privacy-Preserving**: Zero-knowledge liveness. No fingerprints, facial data, or IDs leave the user's device.
- **Bot-Resistant**: Neutralizes AI agents and headless browsers by requiring hardware-backed assertions.
- **Pluggable Storage**: Use the default `MemoryStore` or implement the `IHumanStore` for Redis, SQL, or MongoDB.
- **Hardware Trust Tiers**: Distinguish between high-security smartphones (Secure Enclave) and standard authenticators.
- **Zero-Dependency SDK**: Lightweight browser SDK with no external dependencies.
- **Developer-Centric**: Simple Express middleware and React-friendly hooks.

## 🏗️ Architecture

Human-Proof operates as a stateless challenge-response protocol:

1. **Enrollment**: User registers a "Human-Key" on their device's secure hardware.
2. **Challenge**: Server issues an action-scoped, short-lived (60s) challenge.
3. **Assertion**: User provides a biometric/PIN-unlocked signature from the hardware module.
4. **Verification**: Server validates the signature and hardware attestation to confirm liveness.

Explore the [Architecture Docs](docs/architecture.md) for sequence diagrams and deep dives.

## 🚀 Getting Started

### Installation
```bash
npm install human-proof
```

### Server-Side Configuration (Express)
```typescript
import { HumanProof, createHumanProofMiddleware } from "human-proof/server";

const humanProof = new HumanProof({
  rpId: "example.com",
  rpName: "My Application"
});

const requireHuman = createHumanProofMiddleware(humanProof);

// Protect sensitive endpoints
app.post("/api/vote", requireHuman("vote:submit"), (req, res) => {
  const { result } = req.humanProof!;
  res.json({ success: true, trustTier: result.trustTier });
});
```

### Automated Human Verification
```javascript
import { HumanProofSDK } from "human-proof";

const sdk = new HumanProofSDK({ rpId: "example.com" });

// Automatically attaches human liveness proof to the request
await sdk.protectedFetch("/api/secure-action", {
  method: "POST",
  body: JSON.stringify({ data: "..." }),
  action: "secure:execute"
});
```

### React Hook integration
```tsx
import { useHumanProof } from "human-proof";

function VoteButton() {
  const { execute, isBusy } = useHumanProof({ rpId: "example.com" });
  
  const handleVote = async () => {
    await execute("vote:submit", async () => {
      // Your protected API call here
    });
  };

  return <button onClick={handleVote} disabled={isBusy}>Vote</button>;
}
```

### Client-Side (Browser SDK)
```typescript
import { HumanProofSDK } from "human-proof/sdk";

const sdk = new HumanProofSDK({ rpId: "example.com" });

// Enrollment (once per device)
await sdk.enroll({ userId: "user@example.com" });

// Protected Action
await sdk.protectedFetch("/api/vote", {
  method: "POST",
  body: JSON.stringify({ choice: "A" }),
  action: "vote:submit"
});
```

## 📖 Documentation

- [**Problem Statement**](docs/problem_statement.md): Why presence verification matters in the AI era.
- [**User Stories**](docs/user_stories.md): Stakeholder outcomes and use cases.
- [**Security Model**](docs/security_model.md): Threat analysis and mitigation strategies.
- [**API Reference**](docs/api/index.html): Automatically generated technical documentation.

## 🧪 Development & Testing

We use **Vitest** for testing and **tsup** for high-performance builds.

```bash
npm install     # Install dev dependencies
npm test        # Run unit tests
npm run dev     # Launch the premium demo server (http://localhost:3000)
npm run build   # Generate dual-mode (ESM/CJS) bundles
```

## ⚖️ License

MIT © Human-Proof Team
