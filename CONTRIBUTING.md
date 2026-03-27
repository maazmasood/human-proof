# Contributing to Human-Proof

We love your input! We want to make contributing to this project as easy and transparent as possible.

## 🏁 Standard Workflow

1. **Fork** the repo and create your branch from `main`.
2. **Setup**: Run `npm install`.
3. **Develop**:
    - Make your changes.
    - Add tests if applicable.
    - Run `npm run typecheck` and `npm run lint`.
4. **Test**: Run `npm test` to ensure no regressions.
5. **Build**: Run `npm run build` to verify the bundle.
6. **PR**: Submit a pull request with a clear description.

## 📐 Coding Standards

- **TypeScript**: Use strict types where possible.
- **Errors**: Throw `HumanProofError` from `src/shared/errors.ts` for all protocol failures.
- **Events**: Ensure key lifecycle changes emit an event.
- **Documentation**: Update JSDoc comments for any public-facing API changes.

## 📝 Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: ...` for new features
- `fix: ...` for bugfixes
- `docs: ...` for documentation changes
- `refactor: ...` for code changes that neither fix a bug nor add a feature

---

Thank you for making human-proof better!
