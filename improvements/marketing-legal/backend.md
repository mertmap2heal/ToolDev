# Marketing & Legal — Backend Review

Public marketing surfaces are nearly all static React. The only backend exercised by anything in scope for this package is the auth flow used by `/login`, plus the password-reset path. There is no `/api/landing` or marketing-data endpoint.

## Endpoints in scope

| Method | Path | Used by | Notes |
|--------|------|---------|-------|
| `POST` | `/api/v1/auth/login` | `LoginPage.handleSubmit` via `authService.login` | JWT issued, stored in `localStorage` |
| `POST` | `/api/v1/auth/forgot-password` | `LoginPage.handleForgotPasswordSubmit` via `authService.requestPasswordReset` | Sends temporary password via SMTP; idempotent response message |
| `POST` | `/api/v1/auth/refresh` | Axios interceptor on 401 | Out of direct scope but adjacent |
| `POST` | `/api/v1/auth/logout` | `UserMenu` outside this package | Out of scope |

Route file: `backend/src/routes/auth.routes.ts` (11 endpoints total per `_shared/inventory.md`).

## Login endpoint review

The login path is well-formed. `bcryptjs` for password verification, JWT signed with `JWT_SECRET`, response shape conforms to the standard `{ success, data, error }` per `.claude/kb/backend-patterns.md`. Rate-limiting is not visible at the route layer — this should be confirmed via the global middleware stack. Pre-launch, an aerospace buyer reviewing security posture will ask explicitly about login rate-limiting and account-lockout policy. Both should be in place before any public launch, but neither is a Phase 2 blocker.

**Observability gap.** Failed-login attempts are logged where exactly? The `AuditLog` table is one of 11 audit tables per `_shared/inventory.md` (gap #2). For a regulated-industry tool, failed logins must produce a durable audit event tied to the IP and user-agent — that is table-stakes for `vision-and-usp.md` §8.5 "Human-AI teaming, built into the data model" and for the eventual SOC 2 audit. Out of scope for this Phase 2 marketing rebuild but worth a `tickets.md` cross-reference.

## Forgot-password endpoint review

The endpoint responds identically whether the account exists or not — the success message in `LoginPage.handleForgotPasswordSubmit` is hard-coded to *"If an account exists for that login, you will receive an email..."* regardless of the API response. This is correct anti-enumeration behaviour. The SMTP send is configured via the env vars in `backend/.env.example` (`SMTP_HOST`, `SMTP_PORT`, etc.) and is optional — without SMTP configured the endpoint returns success but no email is sent. Pre-launch this is acceptable; production launch must require SMTP.

## What is NOT in scope but worth flagging

`HelpLayout.tsx` reads from `helpRegistry.ts` which is a static TS file, not a backend call. The legal pages are static React. The landing page makes zero backend calls. So apart from the login flow, the marketing-legal surfaces are fully client-rendered.

There is no analytics tracking on the landing page. For a pre-launch product this is acceptable. Phase 2 should add a single privacy-respecting analytics layer (Plausible or self-hosted Umami) before any paid acquisition motion — this is a separate ticket out of the Phase 2 landing rebuild scope. Per `vision-and-usp.md` §1 we are aerospace-first and ICP-specific; vanity-metric analytics on the marketing site adds noise, not signal. Track three things only: page views, hero-CTA clicks, demo-request clicks.

## Recommendations

- Add login rate-limiting (e.g. 5 attempts per 15 minutes per IP) before any public launch. Not Phase 2 marketing-rebuild scope, but flag in `tickets.md` cross-cuts.
- Audit failed-login events to the universal provenance log when `roadmap.md` Phase B1 lands.
- Confirm SMTP is operational before promoting `/login` forgot-password to production.
- Add minimal privacy-respecting analytics on `/` only — not on `/login`, not on `/help`, not on `/privacy`, not on `/terms`.

No backend code changes required for the Phase 2 landing rebuild itself. The frontend rebuild is fully decoupled from the API surface.
