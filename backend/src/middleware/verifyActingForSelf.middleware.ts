/**
 * SEC-3 (#376) - per-row self-auth check.
 *
 * SHARED PRIMITIVE - this factory is intended for reuse beyond the
 * Requirements reviewer-response endpoint. The architect plan named these
 * plausible future consumers: self-only profile edit
 * (`PATCH /users/:userId/profile`), self-cancel of a subscription, self-edit
 * of own comment, self-revoke of own sign-off, self-respond to own assigned
 * task. The factory is callback-driven so each callsite supplies its own
 * resolver shape.
 *
 * Pattern responsibilities:
 *   - Verify `req.user.userId === <expected user id resolved from the row>`
 *     before allowing the route handler to run, OR
 *   - When the row has no `reviewerId` (external reviewer), verify a signed
 *     token presented in `X-Reviewer-Token` instead of session identity.
 *   - On either failure path, write one deny-audit row to central `AuditLog`
 *     anchored on the protected resource's `projectId`. Action string is
 *     supplied by the caller per the R-8 `<module>:<kebab-verb>` convention.
 *
 * Out-of-scope for this middleware (deferred follow-up SHR-AUDIT-DENY):
 *   - Lifting the inline deny-audit writer to a shared `denyAndAudit` helper
 *     alongside `audit.service.ts`. SEC-3 is the third caller (after SEC-1
 *     and SEC-2 inline writers); the architect plan files this as a separate
 *     ticket. The shape below is kept compatible with that future extraction.
 */
import type { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import type { AuthRequest } from './auth.middleware'
import { verifyReviewerToken } from '../lib/reviewerToken'

/**
 * Resolver contract. Each callsite returns the data the middleware needs to
 * compare against the actor identity.
 *
 *   - `expectedUserId` - the User.id that must equal `req.user.userId` for an
 *     internal session-based call. Set to `null` ONLY when the externalToken
 *     branch should be used (external reviewer, no `reviewerId`).
 *   - `externalToken` - optional. When present, the middleware ignores
 *     `expectedUserId` and instead reads the `X-Reviewer-Token` header,
 *     verifies it against the expected payload, and either passes through or
 *     writes a deny-audit row.
 *   - `resourceProjectId` - the projectId to anchor any deny-audit row on.
 *     When `null`, the deny-audit write is skipped (we cannot determine
 *     which company should see it). The 401/403 response is still emitted.
 *   - `resourceLabel` - kebab-case noun written to the audit row's
 *     `details.resource` field. Distinguishes the resource type so the
 *     audit feed shows context (e.g. `requirement-reviewer-internal` vs
 *     `requirement-reviewer-external`).
 *   - `action` - the `<module>:<kebab-verb>` action string written to the
 *     `AuditLog.action` column. Each caller passes its own; defaults to
 *     `requirements:reviewer-auth-mismatch-denied` to suit the SEC-3 caller.
 *   - Returning `null` from the resolver means "row not found" - the
 *     middleware responds 404 without writing audit.
 */
export interface VerifyActingForSelfResolved {
  expectedUserId: string | null
  externalToken?: {
    expectedReviewId: string
    expectedReviewerEmail: string
    expectedRequirementReviewerId: string
  }
  resourceProjectId: string | null
  resourceLabel: string
  action?: string
}

export type VerifyActingForSelfResolver = (
  req: AuthRequest
) => Promise<VerifyActingForSelfResolved | null>

const DEFAULT_ACTION = 'requirements:reviewer-auth-mismatch-denied'

/**
 * Middleware factory. Must be placed after `authenticateToken` for the
 * session path; the external-token path consults the request directly so
 * the route may also be reachable via token-only requests once the route
 * file decides to wire that surface. The reviewer-response route in SEC-3
 * keeps `authenticateToken` in front; the externalToken branch is exercised
 * only when the row has no `reviewerId` and the caller has presented a
 * valid `X-Reviewer-Token`.
 */
export function verifyActingForSelf(resolver: VerifyActingForSelfResolver) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const resolved = await resolver(req)
      if (!resolved) {
        res.status(404).json({ success: false, error: 'Resource not found' })
        return
      }
      const action = resolved.action ?? DEFAULT_ACTION

      // External-token branch - the row has no internal `reviewerId`, so
      // there is no `req.user` to compare against. Verify the signed token.
      if (resolved.externalToken) {
        const tokenFromHeader =
          (req.header('X-Reviewer-Token') ?? req.header('x-reviewer-token') ?? '').trim()
        if (!tokenFromHeader) {
          await writeDenyAudit({
            projectId: resolved.resourceProjectId,
            userId: req.user?.userId ?? null,
            action,
            resource: resolved.resourceLabel,
            resourceId: extractResourceId(req),
            reason: 'no-token',
            attemptedMethod: req.method,
          })
          res
            .status(401)
            .json({ success: false, error: 'Reviewer token is required' })
          return
        }
        const verifyResult = verifyReviewerToken(tokenFromHeader, {
          reviewId: resolved.externalToken.expectedReviewId,
          reviewerEmail: resolved.externalToken.expectedReviewerEmail,
          requirementReviewerId: resolved.externalToken.expectedRequirementReviewerId,
        })
        if (!verifyResult.ok) {
          await writeDenyAudit({
            projectId: resolved.resourceProjectId,
            userId: req.user?.userId ?? null,
            action,
            resource: resolved.resourceLabel,
            resourceId: extractResourceId(req),
            reason: verifyResult.reason,
            attemptedMethod: req.method,
          })
          res
            .status(403)
            .json({ success: false, error: 'Reviewer token is invalid' })
          return
        }
        next()
        return
      }

      // Internal-session branch - compare authenticated user against the
      // expected row owner.
      const actorUserId = req.user?.userId
      if (!actorUserId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }
      if (!resolved.expectedUserId) {
        // Resolver returned a null expectedUserId without supplying an
        // externalToken expectation. Treat as a defensive 404 - the row is
        // not addressable as either an internal- or external-reviewer
        // response surface (e.g. the reviewer entry has no reviewerId AND
        // no reviewerEmail).
        res.status(404).json({ success: false, error: 'Resource not found' })
        return
      }
      if (resolved.expectedUserId !== actorUserId) {
        await writeDenyAudit({
          projectId: resolved.resourceProjectId,
          userId: actorUserId,
          action,
          resource: resolved.resourceLabel,
          resourceId: extractResourceId(req),
          reason: 'user-id-mismatch',
          attemptedMethod: req.method,
        })
        res.status(403).json({
          success: false,
          error: 'You can only update your own reviewer response',
        })
        return
      }
      next()
    } catch (err) {
      console.error('verifyActingForSelf error:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
}

function extractResourceId(req: AuthRequest): string | null {
  // Reasonable default - the reviewer-response route exposes `:reviewerId`.
  // Future consumers can pick a different param via the resolver's
  // `resourceLabel` if needed; the audit row stores both anyway.
  return req.params.reviewerId ?? req.params.id ?? null
}

async function writeDenyAudit(params: {
  projectId: string | null
  userId: string | null
  action: string
  resource: string
  resourceId: string | null
  reason: string
  attemptedMethod: string
}): Promise<void> {
  try {
    if (!params.projectId) return
    if (!params.userId) return
    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: params.userId,
        action: params.action,
        details: JSON.stringify({
          resource: params.resource,
          resourceId: params.resourceId,
          reason: params.reason,
          attemptedMethod: params.attemptedMethod,
        }),
      },
    })
  } catch (err) {
    // Audit write failure must not break the request - the response has
    // already been chosen at this point. SEC-1 and SEC-2 use the same
    // posture.
    console.error('verifyActingForSelf deny-audit write error:', err)
  }
}
