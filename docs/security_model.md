# Human-Proof Security Model & Threat Analysis

Human-Proof shifts the security perimeter from **per-user identity** to **per-action hardware liveness**.

## 🛡️ Core Security Assumptions
1. **Device Integrity**: The hardware manufacturer's Root of Trust (e.g., Apple A-series chip, Google Titan, TPM 2.0) is reliable.
2. **Local Biometrics**: Biometric verification (FaceID, fingerprint) is performed locally on-device and can unlock the cryptographic key.
3. **Immutability of Secure Enclave**: Private keys generated in the secure enclave cannot be exported or cloned via software even if the OS is compromised.

## 🎯 Threat Analysis & Mitigations

| Threat | Description | human-proof Mitigation |
| :--- | :--- | :--- |
| **Simple Scripts** | Automated scripts or CURL commands. | **Neutralized**: Scripts cannot trigger the browser's biometric prompt or access secure hardware. |
| **Headless Browsers** | Puppeteer or Playwright instances. | **Neutralized**: No physical hardware is attached; the protocol rejects proofs from virtual authenticators (Tier 3). |
| **Replay Attacks** | Capturing a valid proof and reusing it. | **Neutralized**: All challenges are short-lived (60s), single-use, and scoped to a specific action. |
| **Clone Attacks** | Exporting keys to multiple devices. | **Neutralized**: WebAuthn's monotonic sign-count detects and revokes cloned credentials. |
| **AI Agents** | LLM-driven agents performing tasks. | **Neutralized**: AI lacks physical presence to satisfy the biometric requirement. |
| **Phone Farms** | Real humans using real devices at scale. | **Partial**: Increases cost per abuse significantly. Can be detected via Humanity Scoring (interaction consistency). |

## ⚠️ Known Limitations
- **Biometric Bypassing**: If a human is physically present and unlocks the device for a bot, the protocol will verify it as human. human-proof proves liveness, not "intention."
- **Social Engineering**: Users could be tricked into signing a challenge they didn't initiate.
- **Attestation Privacy**: To protect against phone farms, some hardware signals are used (Attestation), which slightly reduces anonymity compared to "None" attestation.

## 📈 Trust Tiers & Policies
The platform operator can set dynamic policies:
- **Low Stakes**: Allow Tier 2 and Tier 3 (standard laptops).
- **High Stakes**: Require Tier 1 (modern smartphone Secure Enclave).
