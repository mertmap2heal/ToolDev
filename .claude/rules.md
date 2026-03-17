# Agent Rules

These rules apply to ALL AI agents (Claude Code, Cursor, Copilot, or any other) working in this repository. They are non-negotiable unless the user explicitly overrides one in the current session.

---

## 1. Infrastructure lock
You are **forbidden** from modifying the environment, Docker configuration, or database schema without explicit user permission. This includes:
- `docker-compose.yml`
- Any Prisma schema changes that would alter or drop existing tables/columns
- Environment variables in `.env` files
- Server ports (frontend: **3000**, backend: **5000**, database: **5432** — never change these)

## 2. Immutable stack
You are **forbidden** from adding new npm/pip/cargo dependencies unless the user explicitly grants permission. If a task would benefit from a new package, **ask first** and justify the choice before touching any `package.json`.

## 3. Never downgrade
Never fix a bug by:
- Deleting a feature or capability
- Downgrading a requirement to a simpler one
- Replacing a more capable model/library with a less capable one (e.g. swapping a powerful LLM for a cheaper/weaker one without explicit instruction)

If a complete solution is hard, say so and ask — do not silently reduce scope.

## 4. Never delete data
You are **forbidden** from deleting existing database records, dropping tables, or running destructive migrations without explicit user permission. This includes:
- `DELETE FROM` queries
- `DROP TABLE` / `DROP COLUMN`
- `prisma migrate reset`
- `docker-compose down -v`

## 5. Plan before acting
For any task involving **more than one file** or **cross-stack logic** (frontend ↔ backend ↔ database), you **must**:
1. Write out your plan as bullet points
2. Wait for user confirmation before writing any code

Single-file, same-layer changes may proceed without a plan.

## 6. Git pull and read before writing
Before modifying any file:
1. Check `git status` and `git diff` to understand the current state
2. **Read** the target file before editing it — never overwrite blindly
3. Prefer `Edit` (targeted diff) over full file rewrites
4. Run `git diff` after changes as a sanity check before committing

## 7. UI design system conformance
When making UI changes, you **must** conform to the existing design system:
- Use existing Tailwind utility classes and colour tokens — do not introduce new ones
- Match spacing, typography, and component patterns already present in `frontend/src/components/`
- Reuse existing components — check `components/` before building a new one
- Do not change global styles (`index.css`, `tailwind.config.js`) without permission

## 8. End-to-end testing required
You **must not** declare any task complete without verifying it works end-to-end. Specifically:
- For backend changes: test the API endpoint with a real HTTP request (curl or the running frontend)
- For frontend changes: visually verify the page renders and the feature works in the browser
- For schema changes: confirm Prisma client regenerated and the app still starts
- "It should work" is **not acceptable** — verify it actually does

## 9. Git workflow (see `git-workflow.md` for full detail)
- **Never commit directly to `main` or `master`** — always use a feature/bugfix/chore branch
- Branch naming: `feature/`, `bugfix/`, `hotfix/`, `chore/`, `docs/`, `refactor/`
- Commit format: Conventional Commits — `feat(scope): summary` (max 72 chars, imperative mood)
- Always include the Co-Authored-By trailer when committing as an AI agent:
  ```
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```
- Stage specific files — never `git add .` unless every change in the tree is intentional
- Never use `--no-verify`, `--force-push` to shared branches, or `--amend` on pushed commits

## 10. Minimal changes — no scope creep
Only make changes **directly required** by the task:
- Do not refactor surrounding code that wasn't asked about
- Do not add comments, docstrings, or type annotations to code you didn't change
- Do not add error handling for scenarios that can't happen
- Do not create abstractions for a single use case
- If you notice a separate issue while working, **flag it** instead of fixing it silently

## 11. Security
Never introduce:
- SQL injection (always use Prisma parameterised queries — never raw string interpolation in `$queryRaw`)
- XSS (never use `dangerouslySetInnerHTML` with unsanitised input)
- Hardcoded secrets, credentials, or API keys in source files
- Exposed sensitive env vars to the frontend (never prefix secret values with `VITE_`)
- JWT secrets or database passwords committed to git

## 12. Context exhaustion protocol
If context is running low or a task spans many files:
- Summarise what has been done and what remains
- Ask the user to start a new session with the summary as context
- Do **not** start cutting corners, skipping steps, or producing half-finished implementations silently
