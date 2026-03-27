# Human-Proof API Reference: Top-Notch Features

This document summarizes the advanced features added during the professionalization phase.

## 🔴 Unified Error Codes (`HumanProofErrorCode`)

Every failure in the protocol returns a standardized error code, allowing for precise programmatic handling.

| Code | Description | HTTP Status |
| :--- | :--- | :--- |
| `HP_CHALLENGE_EXPIRED` | The single-use challenge has timed out. | 401 |
| `HP_CHALLENGE_MISMATCH` | The challenge in the assertion doesn't match the issued one. | 400 |
| `HP_SIGNATURE_INVALID` | Cryptographic signature verification failed (device key mismatch). | 401 |
| `HP_CREDENTIAL_NOT_FOUND` | No enrolled human-key found for this device on the server. | 404 |
| `HP_SECURITY_CONTEXT_REQUIRED` | Protocol called from non-HTTPS origin (browser requirement). | 400 |
| `HP_ALGORITHM_UNSUPPORTED` | Device uses an algorithm not yet supported by human-proof. | 400 |
| `HP_INTERNAL_ERROR` | Unexpected server-side failure. | 500 |

## 📡 Lifecycle Events

Both the **Server (`HumanProof`)** and **Browser (`HumanProofSDK`)** now emit lifecycle events.

### Browser SDK Events
```javascript
const sdk = new HumanProofSDK({ ... });

sdk.on('verify:start', ({ action }) => console.log(`Proving human presence for ${action}...`));
sdk.on('verify:success', () => alert('Proof accepted!'));
sdk.on('verify:error', (err) => console.error('Verification failed', err));
```

### Server Events
```typescript
HumanProof.on('verify:success', ({ credentialId, result }) => {
    // Log human activity to your analytics dashboard
});
```

## ⚛️ React Integration (`useHumanProof`)

```tsx
import { useHumanProof } from 'human-proof';

function VoteButton() {
  const { enroll, execute, isBusy } = useHumanProof({ rpId: 'example.com' });

  return (
    <button disabled={isBusy} onClick={() => execute('vote:submit', submitVote)}>
      Cast Vote
    </button>
  );
}
```

## 🗄️ Storage Adapters

human-proof is storage-agnostic. Use one of our official adapters for production:

### Redis Adapter
```typescript
import { HumanProof, RedisStore } from 'human-proof';
import Redis from 'ioredis';

const redis = new Redis();
const HumanProof = new HumanProof({
  store: new RedisStore(redis, { prefix: 'my-app' })
});
```

### Prisma (SQL) Adapter
```typescript
import { HumanProof, PrismaStore } from 'human-proof';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const HumanProof = new HumanProof({
  store: new PrismaStore(prisma)
});
```
