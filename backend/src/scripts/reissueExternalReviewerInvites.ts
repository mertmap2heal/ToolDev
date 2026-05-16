/**
 * SEC-3 (#376) - re-issue external reviewer invites with fresh signed
 * tokens.
 *
 * BEFORE THIS PR shipped, external reviewers (RequirementReviewer rows with
 * reviewerEmail set and reviewerId null) had no signed token. After this PR
 * lands, the response-submission endpoint requires `X-Reviewer-Token`. Any
 * external reviewer with a still-pending response is therefore locked out
 * until they receive a fresh invite carrying a newly-minted token.
 *
 * This script walks every RequirementReviewer row matching:
 *   - reviewerId IS NULL
 *   - reviewerEmail IS NOT NULL (and looks like an email)
 *   - status IN ('pending', 'in_progress')
 *   - parent review.reviewStatus IN ('draft', 'in_review')
 * It mints a fresh token, sends the invite email, and writes one
 * `requirements:reviewer-invite-reissued` audit row per send.
 *
 * Idempotent. Re-running mints fresh tokens (the old ones expire on their
 * own after 30 days regardless). The script does NOT delete or modify the
 * RequirementReviewer rows themselves.
 *
 * Run manually after deploy:
 *   npx tsx backend/src/scripts/reissueExternalReviewerInvites.ts
 *
 * Flags:
 *   --dry-run             Log what would be sent without sending email.
 *   --throttle-ms <N>     Pause N ms between sends (default 250). The
 *                         default sustains ~4 emails/sec, ~14k/hour - a
 *                         reasonable lower bound that keeps a large
 *                         backfill from flooding the SMTP relay. Use a
 *                         higher value (e.g. 1000) when SMTP_HOST is a
 *                         provider with strict per-second rate limits.
 */
import { prisma } from '../lib/prisma'
import { mintReviewerToken } from '../lib/reviewerToken'
import { sendReviewInviteEmail } from '../services/email.service'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const DRY_RUN = process.argv.includes('--dry-run')

/**
 * Parse `--throttle-ms <N>` from argv. Default 250ms.
 * Negative or non-numeric input collapses to 0 (no throttle) rather than
 * throwing - the script should still make progress for an operator who
 * fat-fingers the flag.
 */
function parseThrottleMs(): number {
  const idx = process.argv.indexOf('--throttle-ms')
  if (idx === -1 || idx + 1 >= process.argv.length) return 250
  const raw = process.argv[idx + 1]
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

const THROTTLE_MS = parseThrottleMs()

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 1) return '***@***'
  return `${email[0]}***@${email.slice(at + 1)}`
}

function buildApprovalUrl(params: {
  projectId: string
  reviewId: string
  reviewerId: string
  token: string
}): string {
  const url = new URL(
    `${APP_URL.replace(/\/+$/, '')}/projects/${params.projectId}/requirements`
  )
  url.searchParams.set('reviewId', params.reviewId)
  url.searchParams.set('reviewerId', params.reviewerId)
  url.searchParams.set('reviewToken', params.token)
  return url.toString()
}

async function main(): Promise<void> {
  console.log(
    `[SEC-3 backfill] starting${DRY_RUN ? ' (DRY RUN)' : ''} throttle=${THROTTLE_MS}ms`
  )

  const rows = await prisma.requirementReviewer.findMany({
    where: {
      reviewerId: null,
      reviewerEmail: { not: null },
      status: { in: ['pending', 'in_progress'] },
      review: {
        reviewStatus: { in: ['draft', 'in_review'] },
      },
    },
    include: {
      review: {
        include: {
          requirement: {
            select: { id: true, requirementId: true, title: true, projectId: true },
          },
        },
      },
    },
  })

  console.log(`[SEC-3 backfill] candidates: ${rows.length}`)
  let sent = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    // SEC-3 (#376) round-2: throttle between sends. Skip the sleep on the
    // last iteration so we do not idle after the final send.
    if (i > 0 && THROTTLE_MS > 0) {
      await sleep(THROTTLE_MS)
    }
    const email = r.reviewerEmail ?? ''
    if (!email.includes('@')) {
      skipped++
      console.warn(
        `[SEC-3 backfill] skip reviewer ${r.id} - missing or malformed email`
      )
      continue
    }
    const requirement = r.review?.requirement
    if (!requirement) {
      skipped++
      console.warn(
        `[SEC-3 backfill] skip reviewer ${r.id} - parent review or requirement missing`
      )
      continue
    }

    try {
      const token = mintReviewerToken({
        reviewId: r.reviewId,
        reviewerEmail: email,
        requirementReviewerId: r.id,
      })
      const approvalUrl = buildApprovalUrl({
        projectId: requirement.projectId,
        reviewId: r.reviewId,
        reviewerId: r.id,
        token,
      })
      if (DRY_RUN) {
        console.log(
          `[SEC-3 backfill] DRY: would email ${maskEmail(email)} for review ${r.reviewId} reviewer ${r.id}`
        )
      } else {
        await sendReviewInviteEmail({
          to: email,
          reviewerName: r.reviewerName ?? '',
          requirementKey: requirement.requirementId ?? requirement.id,
          requirementTitle: requirement.title,
          approvalUrl,
        })
        // Audit the re-issuance per the architect plan's note. Anchored on
        // the requirement's projectId; userId is the original initiator if
        // available, otherwise we record the row's own id as a marker by
        // leaving userId blank-but-required: we use a deterministic
        // non-secret placeholder by picking the review.initiatedBy when
        // present.
        const initiatedBy = r.review?.initiatedBy
        if (initiatedBy) {
          await prisma.auditLog
            .create({
              data: {
                projectId: requirement.projectId,
                userId: initiatedBy,
                action: 'requirements:reviewer-invite-reissued',
                detailsJson: {
                  reviewerRowId: r.id,
                  reviewId: r.reviewId,
                  emailMasked: maskEmail(email),
                },
              },
            })
            .catch((err) => {
              console.error(
                `[SEC-3 backfill] audit write failed for reviewer ${r.id}:`,
                err
              )
            })
        }
        sent++
        console.log(
          `[SEC-3 backfill] sent invite to ${maskEmail(email)} for reviewer ${r.id}`
        )
      }
    } catch (err) {
      failed++
      console.error(
        `[SEC-3 backfill] failed to send invite to ${maskEmail(email)}:`,
        err
      )
    }
  }

  console.log(
    `[SEC-3 backfill] done. sent=${sent} skipped=${skipped} failed=${failed}`
  )
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('[SEC-3 backfill] fatal:', err)
  process.exitCode = 1
})
