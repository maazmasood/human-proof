# Problem Statement: The Sybil Attack & Bot Problem

## The Context
The internet is currently facing an existential threat from the rapid advancement of Generative AI and automated interaction systems. As large language models (LLMs) achieve human-level reasoning and interaction capabilities, the traditional methods of distinguishing between a human user and an automated script are failing.

## The Problem: Obsolete Defenses
Existing anti-abuse mechanisms were designed for a different era of automation:

### 1. CAPTCHAs are No Longer Effective
Modern computer vision and AI agents can solve traditional CAPTCHAs with higher accuracy and speed than humans. They have become nothing more than a UX friction point for real users while failing to stop sophisticated bots.

### 2. Identity Verification vs. Presence Verification
Many systems attempt to solve the "bot problem" by requiring government IDs or centralized biometric databases (Worldcoin, etc.). This introduces severe privacy risks, surveillance concerns, and exclusionary barriers for users in certain jurisdictions. More importantly, **Identity does not equal Presence**—a stolen identity can still be used for mass automation.

### 3. Economic Imbalance
The "Cost per Abuse" has plummeted. An attacker can spin up millions of headless browsers and AI agents to manipulate voting, farm rewards, or flood social platforms with synthetic content at a negligible cost.

## The Solution: Hardware-Backed Liveness
human-proof proposes a shift from **Identity** to **Physical Presence Proof**. 

Instead of asking *"Who are you?"*, we ask: *"Is there a human physically interacting with a real device right now?"*

By leveraging the **Secure Enclave** and **TPM** modules already present in billions of modern devices (smartphones, laptops), we can generate cryptographic proofs that require physical biometric or PIN-based interaction. This raises the cost of automation from "cheap CPU cycles" to "one physical device per concurrent action," effectively neutralizing mass-scale bot attacks while preserving total user privacy.
