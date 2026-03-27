# Human-Proof Integration Patterns: Sessions vs. Actions

Human-Proof supports two primary integration patterns depending on the security requirements of your application.

## 1. Per-Action Verification (High Security)
*The default pattern.* Every sensitive action (e.g., sending money, voting, posting) requires a fresh biometric/hardware signature.

- **Pros**: Maximum security, prevents session hijacking by bots, atomic proof for every ledger entry.
- **Cons**: higher UX friction.
- **Use Case**: Financial transactions, governance votes, account recovery.

## 2. Session-Based Verification (Balanced UX)
A user proves they are human once (e.g., at login or during a "Proof of Humanity" flow), and then is trusted for a set duration (e.g., 24 hours).

- **Pros**: Low UX friction, "Verify once, browse freely."
- **Cons**: If the session cookie is stolen, the bot can act as a human until the session expires.
- **Use Case**: General social media, sybil-resistant air-drops, bot-protected browsing.

### Implementation Guide (Session Pattern)
To implement session-based verification, you can store the `isHuman` status in your existing session store (JWT, Redis session, etc.).

#### 🟢 Server Implementation
```typescript
app.post("/api/verify-human", async (req, res) => {
  const result = await HumanProof.verify(req.body, req.headers.origin!);
  
  if (result.isHuman) {
    // 1. Mark the user's session as human
    req.session.isHuman = true;
    req.session.humanTrustTier = result.trustTier;
    req.session.humanVerifiedAt = Date.now();
    
    res.json({ success: true });
  } else {
    res.status(401).json({ error: "Verification failed" });
  }
});

// Generic middleware for other routes
const sessionVerify = (req, res, next) => {
  if (req.session.isHuman) return next();
  res.status(403).json({ error: "Human verification required" });
};
```

#### 🔵 Client Implementation
```javascript
async function enterRestrictedArea() {
  if (!user.isVerifiedHuman) {
    // Trigger one-time proof
    const proof = await sdk.prove("session:init");
    await fetch("/api/verify-human", {
      method: "POST",
      body: JSON.stringify(proof)
    });
  }
  // Proceed with normal actions...
}
```

## When to use which?
| Feature | Per-Action | Session-Based |
| :--- | :--- | :--- |
| **Security** | 🛡️🛡️🛡️ (Absolute) | 🛡️🛡️ (High) |
| **UX** | ⚠️ (High Friction) | ✅ (Smooth) |
| **Bot Resistance** | Perfect | Strong (Session-Limited) |
| **Example** | DAO Voting | Social Feed |

Developers can also use a **Hybrid Approach**: Use session-based trust for 99% of the app, but escalate to per-action verification for high-value operations.
