/**
 * SEC-3 (#376) - external-reviewer signed-token helpers.
 *
 * External reviewers attached to a `RequirementReview` row by email only (no
 * `reviewerId`) have no session JWT, so the regular `authenticateToken` path
 * does not establish identity. Instead, an out-of-band signed token is minted
 * at review-creation time, delivered via the invite email, and presented in
 * the `X-Reviewer-Token` header on the response-submission request.
 *
 * Reuse policy per the architect plan:
 *   - Reuse `process.env.JWT_SECRET` (no new key material).
 *   - Reuse the `jsonwebtoken` library (no new dependency).
 *   - Token payload binds all four fields needed to defeat replay or forgery:
 *     `reviewId`, `reviewerEmail`, `requirementReviewerId`, `purpose`.
 *   - Expiry 30 days - matches the invite-life expectations in the architect's
 *     plan. After expiry the script `reissueExternalReviewerInvites.ts`
 *     mints a fresh token and re-sends the invite email.
 *
 * The token is verified by `verifyActingForSelf.middleware.ts`; the
 * service layer never decodes the token directly.
 */
import jwt from 'jsonwebtoken'

const TOKEN_EXPIRY = '30d'
const TOKEN_PURPOSE = 'reviewer-response'

export interface ReviewerTokenPayload {
  reviewId: string
  reviewerEmail: string
  requirementReviewerId: string
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'no-secret' | 'invalid-or-expired' | 'wrong-purpose' | 'review-mismatch' | 'email-mismatch' | 'reviewer-mismatch' }

/**
 * Mint a signed JWT bound to a specific external-reviewer row. The returned
 * string is safe to deliver via email or query parameter; the only secret
 * material is `JWT_SECRET`, which is not echoed back in the payload.
 */
export function mintReviewerToken(payload: ReviewerTokenPayload): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not defined')
  }
  return jwt.sign(
    {
      reviewId: payload.reviewId,
      reviewerEmail: payload.reviewerEmail,
      requirementReviewerId: payload.requirementReviewerId,
      purpose: TOKEN_PURPOSE,
    },
    secret,
    { expiresIn: TOKEN_EXPIRY }
  )
}

/**
 * Verify a presented token. Returns `{ ok: true }` only when the signature is
 * valid, the token has not expired, the `purpose` field matches
 * 'reviewer-response', and every bound field equals the expected reviewer row
 * fields. Any mismatch returns a non-leaking reason code for the caller to
 * log; the HTTP response is always a generic 401/403.
 */
export function verifyReviewerToken(
  token: string,
  expected: ReviewerTokenPayload
): VerifyResult {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    return { ok: false, reason: 'no-secret' }
  }
  let decoded: Record<string, unknown>
  try {
    decoded = jwt.verify(token, secret) as Record<string, unknown>
  } catch {
    return { ok: false, reason: 'invalid-or-expired' }
  }
  if (decoded.purpose !== TOKEN_PURPOSE) {
    return { ok: false, reason: 'wrong-purpose' }
  }
  if (decoded.reviewId !== expected.reviewId) {
    return { ok: false, reason: 'review-mismatch' }
  }
  if (decoded.reviewerEmail !== expected.reviewerEmail) {
    return { ok: false, reason: 'email-mismatch' }
  }
  if (decoded.requirementReviewerId !== expected.requirementReviewerId) {
    return { ok: false, reason: 'reviewer-mismatch' }
  }
  return { ok: true }
}
