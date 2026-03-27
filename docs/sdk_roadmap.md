# Human-Proof SDK Roadmap & Elevation Plan

To transition Human-Proof from a functional library to a "top-notch" open-source SDK, we follow the standards set by industry leaders like Stripe and Supabase.

## 🏁 Standards & Principles

### 1. Developer Experience (DX) First
- **Zero-Config**: Reasonable defaults for everything (e.g., in-memory store by default).
- **Intelligent Types**: Deeply nested TypeScript interfaces for full autocompletion.
- **Meaningful Errors**: Every error should have a unique code and a clear "how to fix" message.

### 2. Consistency & Reliability
- **Custom Error Classes**: Instead of `throw new Error("msg")`, use `throw new HumanProofError({ code: '...', message: '...' })`.
- **Event-Driven**: Support lifecycle hooks (`onVerified`, `onEnrollmentFailed`).
- **Telemetry-Ready**: Safe hooks for analytics and logging.

### 3. Production Hardening
- **Environment Parity**: Works identically in Node.js, Vercel Edge, Deno, and the Browser.
- **Middleware Security**: Built-in rate limiting and anti-replay guards.
- **Dependency-Free**: Keep the browser SDK bundle size under 2KB.

## 📋 Implementation Roadmap

### Phase 1: Robust Foundation (COMPLETE)
- [x] **Unified Error System**: Categorized errors (Security, Configuration, Network).
- [x] **Event Emitters**: Allow developers to subscribe to protocol events.
- [x] **SDK Configuration Builder**: A fluent API for initializing the SDK.

### Phase 2: Framework Integration (COMPLETE)
- [x] **React Hooks**: `useHumanProof()` for easy integration in modern web apps.
- [x] **Next.js Examples**: A reference implementation for App Router.
- [x] **Storage Adapters**: Official Redis and SQL (Prisma) adapters.

### Phase 3: Community & Maintenance (COMPLETE)
- [x] **Automated API Docs**: Generated via TypeDoc.
- [x] **Contribution Guide**: Clear standards for PRs and issues.
- [x] **Security Policy**: A `SECURITY.md` for responsible disclosure.

---

*This roadmap is a living document and will be updated as the protocol evolves.*
