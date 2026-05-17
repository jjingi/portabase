# OIDC E2E Design

Date: 2026-05-17
Topic: Playwright coverage for OIDC login/logout with Keycloak, Authentik, and Pocket ID

## Goal

Add end-to-end coverage for OIDC authentication providers by testing only the shared happy path:

- open the login page
- sign in through the selected OIDC provider
- confirm redirect to the dashboard home page
- log out
- confirm redirect back to the login page

This work must follow the same general patterns already used by the existing Playwright authentication, storage, and notification tests.

## Scope

In scope:

- add Playwright tests for Keycloak, Authentik, and Pocket ID
- add or update helper utilities needed for provider-specific login steps
- rename `docker-compose.func.yml` to a clearer name for OIDC/social test dependencies
- extend the compose stack to include Authentik
- add documented local `.env` examples for the three OIDC providers
- update the E2E GitHub Actions workflow so the OIDC stack is started and reachable during Playwright runs

Out of scope:

- testing password auth changes
- testing account linking or unlinking
- testing role mapping behavior
- testing failed logins or provider-specific edge cases
- changing the app auth architecture beyond what is required to support deterministic tests

## Current State

The repository already includes:

- password-auth Playwright tests in `e2e/auth.spec.ts`
- reusable auth helpers in `e2e/helpers/auth.ts`
- a functional compose file named `docker-compose.func.yml`
- local development seed data for Keycloak in `seeds/keycloak/`
- local development seed data for Pocket ID in `seeds/pocket-id/`
- multi-provider OIDC parsing in `src/lib/auth/oidc.ts`
- an E2E GitHub Actions workflow in `.github/workflows/e2e.yml`

The repository does not yet include:

- Playwright coverage for OIDC providers
- an Authentik service in the functional compose stack
- Authentik seed/bootstrap assets comparable to Keycloak and Pocket ID
- CI wiring that starts the OIDC providers before Playwright runs

## Key Decisions

### Test organization

The new coverage will live in a dedicated spec, `e2e/oidc.spec.ts`, instead of being merged into `e2e/auth.spec.ts`.

Reasons:

- credential auth and external IdP auth fail for different reasons
- per-provider OIDC failures will be easier to isolate
- the existing auth spec can stay focused on local registration and password login behavior

The spec will run serially to reduce the chance of state collisions between provider sessions and first-login user creation.

### Provider model

All three providers will be configured through the dynamic multi-provider OIDC env format:

- `AUTH_OIDC_KEYCLOAK_*`
- `AUTH_OIDC_AUTHENTIK_*`
- `AUTH_OIDC_POCKET_*`

This avoids the limitation of the single-provider `AUTH_OIDC_*` variables and matches the current dynamic parsing logic in `src/lib/auth/oidc.ts`.

### Supported assertions

Each provider test will assert only:

- the provider button is available on `/login`
- successful redirect to `/dashboard/home` after authentication
- successful logout through the existing profile menu flow
- redirect back to `/login` after logout

No provider-specific role or profile assertions will be added in this first pass.

## Provider Configuration Design

### Local and CI env shape

`.env.example` will be extended with example blocks for:

- Keycloak
- Authentik
- Pocket ID

Each block will define:

- provider id
- title
- client id
- client secret
- issuer URL
- host
- scopes
- PKCE flag
- role/default access settings only if required for deterministic login

The titles should match the labels that appear in the login buttons so the Playwright tests can use stable selectors.

### Host and issuer split

The design must account for two different consumers:

- Playwright in the host environment, which drives the browser through `localhost`
- the Portabase app container, which may need to resolve provider services over the Docker network

Where necessary, provider config should preserve browser-visible callback flows on `localhost` while still allowing the app to resolve the provider from inside its container context. If one shared value cannot satisfy both paths, the implementation should prefer explicit Docker networking or service aliases instead of fragile URL rewriting in tests.

## Compose Stack Design

### File rename

`docker-compose.func.yml` will be renamed to a clearer name describing its purpose as OIDC/social-auth test infrastructure.

All repo references must be updated, including:

- `Makefile`
- documentation references if any exist in the repo
- local developer commands
- CI workflow steps that will use the renamed file

### Services

The renamed compose stack will contain:

- Keycloak
- Pocket ID
- Authentik
- any Authentik-required backing services such as PostgreSQL and Redis, if the chosen Authentik image/setup requires them

### Authentik bootstrap

Unlike Keycloak and Pocket ID, Authentik does not currently have seed assets in the repository. The implementation therefore needs a deterministic bootstrap strategy.

Preferred direction:

- add a reproducible Authentik bootstrap flow through compose configuration, mounted setup assets, or scripted API/bootstrap initialization
- ensure a known OIDC client exists for Portabase
- ensure a known test user exists for Playwright login
- ensure redirect URIs and client credentials match the env values passed to the app

The bootstrap should be automated enough for local verification and CI execution without manual UI setup.

## Playwright Design

### Spec layout

Create `e2e/oidc.spec.ts` with one test per provider:

- `OIDC login/logout with Keycloak`
- `OIDC login/logout with Authentik`
- `OIDC login/logout with Pocket ID`

The spec should use existing project conventions:

- import from `@playwright/test`
- centralize helper logic in `e2e/helpers`
- avoid duplicating logout logic already covered by `e2e/helpers/auth.ts`

### Helper structure

Add a provider-focused helper module, likely `e2e/helpers/oidc.ts`, that contains:

- typed provider test credentials
- provider button selection logic
- provider-specific login steps

The helper should expose a single high-level function that the spec can call with a provider identifier. Internally it can branch on provider-specific pages and selectors.

### Selector strategy

Use stable selectors in this order of preference:

1. semantic button names on the Portabase login page
2. form field names or labels on provider login pages
3. narrowly scoped fallback selectors only if the provider UI gives no better option

The tests should avoid brittle text assertions unrelated to the login/logout contract.

## CI Design

### Workflow changes

`.github/workflows/e2e.yml` will be updated to:

- start the renamed OIDC compose stack before the app container
- wait for the provider services to become reachable
- run the Portabase app container with all required OIDC env vars
- keep `PROJECT_URL` pointing to `http://localhost:8887` for browser navigation
- run Playwright after both the app and provider stack are ready

### Connectivity expectations

The workflow must make provider endpoints reachable from both:

- the browser on the GitHub runner host
- the Portabase container during OIDC processing

The implementation should prefer straightforward Docker networking over custom proxying in Playwright.

## Verification Plan

Minimum verification:

- run the new OIDC Playwright spec locally against the compose-backed providers
- run `pnpm lint`

If the environment allows:

- run the full Playwright suite to confirm the new OIDC setup does not regress existing tests

## Risks And Mitigations

### Risk: provider bootstrap drift

Authentik is the highest-risk part because the repo has no existing seeded setup.

Mitigation:

- keep the bootstrap explicit and versioned in the repo
- avoid manual one-off setup that CI cannot reproduce

### Risk: container-to-provider networking mismatch

OIDC often fails when browser URLs and server-resolved issuer URLs disagree.

Mitigation:

- keep provider URLs intentional and documented
- validate both the runner/browser path and the app container path during local verification

### Risk: brittle provider UI selectors

Third-party login pages may change independently from Portabase.

Mitigation:

- use the smallest possible assertion surface
- centralize provider selectors in one helper for easy maintenance

## Implementation Summary

The implementation should make the smallest change that adds deterministic OIDC login/logout coverage for Keycloak, Authentik, and Pocket ID across local development and GitHub Actions. It should do so by adding a dedicated OIDC spec, reusing existing auth helper patterns, renaming and extending the test dependency compose stack, documenting multi-provider OIDC env configuration, and wiring the CI workflow to launch the provider stack before Playwright runs.
