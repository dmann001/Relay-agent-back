# Relay Agent Back Quality Assurance Strategy

## Purpose

This document defines how the Relay Agent Back team will verify software quality, prevent regressions, and decide whether a change is ready to merge or release. The strategy applies to the Next.js frontend and API routes, the Express backend, Gmail OAuth and Gmail API integration, Supabase data access, and OpenAI-powered email features.

## A. Testing Goals

Testing is important because Relay Agent Back handles private email content, OAuth credentials, generated drafts, and automated actions. A defect can expose user data, send an incorrect message, lose email state, or cause an AI feature to take an unintended action.

The team's testing goals are to:

- Protect the confidentiality and integrity of email, account, and token data.
- Verify that authentication and authorization boundaries cannot be bypassed.
- Prevent regressions in inbox, thread, compose, archive, draft, and sent-email workflows.
- Make AI output reviewable, bounded, and safe when responses are incomplete or incorrect.
- Detect API, validation, and error-handling defects before code reaches `main`.
- Keep the application usable across supported screen sizes and modern browsers.
- Provide fast, repeatable feedback through automated checks on every push and pull request.

### Primary Risks

| Risk | Example impact | Required response |
| --- | --- | --- |
| Authentication failure | A user cannot connect Gmail, or one user accesses another user's account | Block release and investigate immediately |
| Token or API-key exposure | OAuth refresh token, Supabase service key, or OpenAI key appears in logs or client code | Revoke the secret, block release, and complete a security review |
| Incorrect email mutation | The wrong message is sent, archived, deleted, or modified | Block release; add a regression test before fixing |
| Data corruption or loss | Email metadata, reminders, drafts, or embeddings are overwritten incorrectly | Block release and verify recovery procedures |
| AI hallucination or unsafe automation | A generated reply invents facts or an inferred action is executed without confirmation | Disable the affected automation and require user confirmation |
| External API failure | Gmail, Supabase, or OpenAI timeout causes a crash or inconsistent state | Show a recoverable error and preserve user data |
| Injection or unsafe content | Malicious email HTML or user input executes script or alters a query | Block release and treat as a security incident |
| Performance degradation | Inbox loading or AI processing becomes too slow for normal use | Measure the bottleneck and set a remediation target |

The most critical failures are unauthorized access, exposed secrets, sending or changing the wrong email, permanent data loss, and unreviewed AI actions. These are release-blocking defects.

## B. Planned Types of Testing

### Smoke Testing

Smoke tests provide a quick confirmation that a deployed or locally built version is usable before deeper testing begins.

For each release candidate, a team member will manually verify:

1. The landing page and login page load without console errors.
2. A user can connect a test Gmail account through OAuth.
3. Inbox, thread, drafts, sent, archives, settings, and status pages open.
4. Email synchronization returns data or a clear recoverable error.
5. A draft can be created and reviewed without sending it.
6. AI classification and draft generation return a result or a useful failure message.
7. Sign-out or session expiry prevents further authenticated access.

Usability and visual checks will be performed at desktop and mobile widths in the latest Chrome and one additional modern browser. Reviewers will check keyboard navigation, loading states, empty states, error messages, overflow, contrast, and responsive layout. Real email sending will use a dedicated test account and an approved recipient.

### Unit Testing

Jest is the unit-testing framework. Unit tests must isolate external services with mocks or fakes so that CI never requires real Gmail, Supabase, or OpenAI credentials.

Unit-test priorities are:

- Email HTML sanitization, plain-text conversion, HTML detection, and attachment-size formatting in `lib/email-utils.ts`.
- Request validation and response mapping for API helpers.
- AI command parsing, classification boundaries, and safe fallback behavior.
- Gmail message and attachment transformation.
- Storage and reminder state transitions.
- Error handling for missing, malformed, and boundary-value input.

The initial coverage target is at least 70% statement and branch coverage for actively maintained utility and service modules. Authentication, authorization, email mutation, HTML sanitization, and AI action-confirmation logic target at least 80%. Coverage will be measured as the test suite expands; a threshold will become a CI gate after the baseline reaches these targets.

### Integration Testing

Integration tests will verify contracts between components while keeping third-party side effects controlled.

Planned integration coverage includes:

- Next.js or Express API route plus validation and service layer.
- Gmail OAuth callback plus token persistence and account identification.
- Gmail API adapters plus email parsing, pagination, attachment handling, and error mapping.
- Supabase client plus the project schema using an isolated test project or local instance.
- OpenAI service plus structured-output validation using mocked API responses.
- Frontend API client plus backend success, unauthorized, rate-limit, timeout, and server-error responses.

Integration test data must use non-production accounts and databases. Tests must clean up records they create and must not send messages to real users.

### End-to-End Testing

Playwright is the planned E2E framework. E2E tests will run against a test environment with seeded data and mocked external APIs where practical.

Priority user workflows are:

1. Open the application, authenticate, and connect a Gmail test account.
2. Synchronize the inbox, open an email thread, and view sanitized content.
3. Search or filter messages and move between inbox, archive, drafts, and sent views.
4. Generate an AI draft, edit it, confirm the recipient, and send through a test account.
5. Submit an AI command, review the proposed action, and approve or cancel it.
6. Handle expired authentication, API failure, empty inbox, and rate-limit states.
7. Change settings and verify that the change persists after reload.

No production account or production email recipient may be used by automated E2E tests.

### Performance and Load Testing

The first performance baseline will measure:

- Inbox API response time for small and large mailboxes.
- Gmail synchronization time and pagination behavior.
- OpenAI classification and draft-generation latency.
- Supabase query latency for email metadata and vector retrieval.
- Frontend page-load and interaction responsiveness.

The team plans to use browser performance tools for client measurements and a scripted tool such as k6 for API load tests. Initial service targets are a p95 under 500 ms for internal API work that does not wait on an external provider, and clear progress or loading feedback for external operations exceeding one second. Tests will include concurrent requests, provider timeouts, retries, and rate limits. Results will be recorded before each major release and compared with the previous baseline.

### Security Testing

Security verification will include:

- Confirming secrets exist only in environment variables or protected GitHub secrets.
- Scanning commits and logs for OAuth tokens, API keys, and Supabase service credentials.
- Testing unauthenticated and cross-user access to protected routes and records.
- Validating and constraining all route parameters, request bodies, email addresses, and AI output.
- Testing stored and reflected cross-site scripting through malicious email HTML.
- Verifying that database access uses parameterized APIs and row-level security where applicable.
- Testing OAuth `state`, redirect handling, token expiry, token refresh, and revoked access.
- Verifying rate limiting and safe error messages on sensitive and expensive endpoints.
- Running dependency vulnerability review with `pnpm audit` during release preparation.

Critical and high-severity security defects block merging and release. Secrets found in history must be rotated even if the exposed value is later removed.

## C. Pull Request Quality Rules

Every pull request must meet these conditions:

- Work is developed on a branch; direct pushes to `main` are not allowed.
- The pull request explains the change, testing performed, risk, and any screenshots needed for UI work.
- The pull request links the relevant issue or backlog item.
- GitHub Actions dependency installation, lint, tests, and production build all pass.
- New or changed behavior includes appropriate automated tests, or the pull request explains why automation is not yet practical.
- One team member other than the author reviews and approves the change.
- Review conversations are resolved before merge.
- No secrets, production data, generated coverage output, or local environment files are committed.
- High-risk changes to authentication, email mutation, data storage, or AI actions receive a second focused review.
- The branch is up to date with `main` before merge.

Repository branch protection should require the `CI / quality` check and one approving review. Pull requests should use squash merging so each merged change has a clear history and can be reverted cleanly.

## Quality Responsibilities

Quality is shared by the team:

- The author adds tests, runs local checks, documents manual verification, and fixes CI failures.
- The reviewer checks behavior, security implications, test quality, error handling, and maintainability.
- The project manager confirms release-blocking issues are resolved and required evidence is collected.
- The team member responsible for a service maintains its test data, mocks, and integration-test setup.

Defects will be recorded as GitHub Issues with reproduction steps, expected and actual behavior, severity, environment, and supporting evidence. Release-blocking defects are labeled `priority: critical` or `priority: high` and cannot be deferred without team agreement.

## Automated CI Pipeline

The workflow at `.github/workflows/ci.yml` runs on every push and pull request. It:

1. Checks out the repository.
2. Installs the package-manager version declared in `package.json`.
3. Configures Node.js 22 and the pnpm dependency cache.
4. Installs dependencies from `pnpm-lock.yaml` with a frozen lockfile.
5. Runs ESLint.
6. Runs Jest in CI mode.
7. Creates a production Next.js build.

Local equivalents are:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test:ci
pnpm build
```

The current CI pipeline does not require live third-party credentials. Tests that need external services must use mocks or a separately protected test environment.

## Current Baseline and Improvement Backlog

As of June 11, 2026:

- The Jest suite contains 11 passing tests for email utility behavior.
- ESLint completes successfully but reports existing warnings that should be reduced over time.
- The production Next.js build completes successfully.
- Standalone `tsc --noEmit` is not yet a CI gate because unused UI components reference undeclared packages and two status comparisons require correction.
- Automated integration, E2E, load, and security suites are planned work and should be tracked through GitHub Issues.

The team will review this strategy at the end of each sprint and update it when architecture, risks, tooling, or release requirements change.
