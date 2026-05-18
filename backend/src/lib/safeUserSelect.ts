/**
 * Safe `User` field selection for API responses.
 *
 * The `User` Prisma model carries `password` — the bcrypt hash. A bare
 * `include: { user: true }` (or `include: { owner: true }` / any other
 * `User` relation) serialises that hash into the HTTP response, exposing it
 * to every authenticated client. The NX-8 security review flagged this on
 * the audit-read endpoints (`getProjectAuditLogs`) and noted it as a
 * codebase-wide pattern.
 *
 * Use `SAFE_USER_SELECT` at every site where a `User` row reaches a client:
 *
 *   include: { user:    { select: SAFE_USER_SELECT } }
 *   include: { owner:   { select: SAFE_USER_SELECT },
 *              createdBy:{ select: SAFE_USER_SELECT } }
 *
 * Defining the safe field set once — and only once — means a `User`
 * relation can never be re-introduced into a response with the hash
 * attached by an incomplete per-site `select`.
 *
 * It lists only the non-sensitive fields a consumer genuinely needs to
 * render an actor: `id`, `name`, `email`, `role`. It NEVER includes
 * `password`. Add a field here only after confirming it is not sensitive.
 *
 * Auth read paths (login, password reset, change-password in
 * `auth.controller.ts`) legitimately read the full row for `bcrypt.compare`
 * and must NOT use this constant — they never return the raw `User` to the
 * client.
 */
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const
