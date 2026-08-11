# Testing Overview

All automated tests and test-runner configuration live in this directory.

## Directory Structure

```text
Tests/
  contracts/      Static contracts for the Supabase schema and RLS policies
  e2e/            Playwright browser tests
  integration/    API route tests with external services mocked
  performance/    Generous regression budgets for core email operations
  unit/
    components/   React component and authentication-provider tests
    lib/          Frontend API client and email utility tests
    lib/server/   Gmail, encryption, API error, and Supabase auth tests
  jest.config.mjs
  jest.setup.ts
  playwright.config.ts
  testing.md
```

## Test Types

### Unit tests

- Email HTML/plain-text detection, sanitization, and file-size formatting
- Gmail metadata parsing, MIME generation, attachment handling, history deltas,
  message actions, sending, and drafts
- AES-256-GCM token encryption and OAuth state expiration
- Supabase bearer-token validation and service-role client configuration
- Frontend API authentication, request payloads, errors, and update events

### React component tests

- Protected-route and public-route behavior in `AuthProvider`
- Search debounce, Enter submission, clearing, and disabled state

### Integration tests

- `/api/accounts` authentication and user-scoped deletion
- Verification that Gmail access and refresh tokens never reach API responses
- Gmail and Supabase calls are mocked so pull requests do not need live secrets

### Database contract tests

- Row Level Security is enabled for user-owned tables
- Select, insert, update, and delete policies require `auth.uid()`
- Sync-state ownership is derived through the connected account
- Duplicate email/draft constraints and provider/category checks are present

These tests inspect `supabase/schema.sql`. They do not start a local Supabase
instance or execute migrations against PostgreSQL.

### End-to-end tests

Playwright runs Chromium against the production Next.js build and checks:

- Landing-page login-link navigation
- Public login-page rendering
- Sign-in validation
- Account-creation password confirmation

Authenticated Gmail workflows require controlled Supabase and Google test
accounts. They should be added as a separate secret-backed staging workflow,
not to untrusted pull-request jobs.

### Performance tests

Core Gmail metadata parsing and attachment encoding have generous time budgets.
These are regression guards, not production load or capacity benchmarks.

### Security checks

- OAuth state integrity and expiration
- Encrypted token round trips and tamper rejection
- Header-injection prevention in generated MIME messages
- RLS/schema ownership contracts
- `pnpm audit --audit-level high`
- GitHub CodeQL JavaScript/TypeScript analysis

## Commands

```bash
pnpm test          # Jest tests without coverage
pnpm test:ci       # Jest tests with coverage thresholds
pnpm test:e2e      # Playwright browser tests; requires a production build
pnpm lint
pnpm typecheck
pnpm build
pnpm audit --audit-level high
```

For a first local Playwright run:

```bash
pnpm exec playwright install chromium
pnpm build
pnpm test:e2e
```

## Coverage Gate

CI collects coverage from the core modules listed in `jest.config.mjs` and fails
below these global minimums:

| Metric | Minimum |
| --- | ---: |
| Statements | 100% |
| Branches | 100% |
| Functions | 100% |
| Lines | 100% |

As verified on August 11, 2026, all four metrics are 100% across the configured
core-module scope. Coverage output is uploaded as the `coverage` GitHub Actions
artifact. This scoped result does not claim that every production file or live
provider workflow is covered.

## CI Jobs

The workflow in `.github/workflows/ci.yml` runs three independent jobs:

1. `quality`: install, lint, type check, Jest/coverage, production build
2. `browser`: install Chromium, production build, Playwright tests
3. `security`: dependency audit and CodeQL analysis

Live Gmail and hosted Supabase calls are intentionally excluded from normal
pull-request CI to avoid exposing credentials or mutating real user data.
