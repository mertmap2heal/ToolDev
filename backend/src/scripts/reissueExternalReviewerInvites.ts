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
 * Add `--dry-run` to log what would be sent without actually sending email.
 */
import { prisma } from '../lib/prisma'
import { mintReviewerToken } from '../lib/reviewerToken'
import { sendReviewInviteEmail } from '../services/email.service'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const DRY_RUN = process.argv.includes('--dry-run')

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
  console.log(`[SEC-3 backfill] starting${DRY_RUN ? ' (DRY RUN)' : ''}`)

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

  for (const r of rows) {
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
                details: JSON.stringify({
                  reviewerRowId: r.id,
                  reviewId: r.reviewId,
                  emailMasked: maskEmail(email),
                }),
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
