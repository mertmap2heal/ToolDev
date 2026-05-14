// V-Q3: one-line summaries for every validation audit action.
// Activity feed renders these instead of raw JSON details. The full payload is
// preserved under a `title` attribute for power users who need to inspect it.

type Details = Record<string, unknown>

function s(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function n(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}
function trim(text: string | undefined, max = 80): string {
  if (!text) return ''
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

export interface ActivitySummaryArgs {
  action: string
  details: string | null | undefined
  actorName?: string | null
}

function parseDetails(raw: string | null | undefined): Details {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw)
    return typeof v === 'object' && v !== null ? (v as Details) : {}
  } catch {
    return {}
  }
}

export function summariseActivity(args: ActivitySummaryArgs): string {
  const d = parseDetails(args.details)
  const key = s(d.key) ?? s(d.validationKey)
  const idTail = (s(d.validationItemId) ?? '').slice(0, 8)
  const item = key ?? (idTail ? `item ${idTail}…` : 'item')
  const title = s(d.title)

  switch (args.action) {
    case 'validation:create':
      return `Created ${item}${title ? ` — "${trim(title)}"` : ''}${
        s(d.methodType) ? ` (${s(d.methodType)} → ${s(d.targetMilestone) ?? '—'})` : ''
      }`
    case 'validation:update': {
      const fields = Array.isArray(d.fields) ? (d.fields as unknown[]).filter((x): x is string => typeof x === 'string') : []
      return `Updated ${item}${fields.length ? ` (${fields.join(', ')})` : ''}`
    }
    case 'validation:duplicate':
      return `Duplicated ${s(d.fromKey) ?? 'item'} → ${item}`
    case 'validation:delete':
      return `Archived ${item}${s(d.reason) ? ` — "${trim(s(d.reason), 60)}"` : ''}`
    case 'validation:restore':
      return `Restored ${item}`
    case 'validation:bulk-update': {
      const count = n(d.count) ?? n(d.updated) ?? 0
      const change = s(d.field)
      return `Bulk update — ${count} item${count === 1 ? '' : 's'}${change ? ` (${change})` : ''}`
    }
    case 'validation:bulk-from-requirements': {
      const count = n(d.count) ?? 0
      return `Created ${count} item${count === 1 ? '' : 's'} from requirements`
    }
    case 'validation:link-requirement':
      return `Linked ${item} to requirement ${s(d.requirementKey) ?? s(d.requirementId)?.slice(0, 8) ?? ''}`.trim()
    case 'validation:unlink-requirement':
      return `Unlinked ${item} from requirement ${s(d.requirementKey) ?? s(d.requirementId)?.slice(0, 8) ?? ''}`.trim()
    case 'validation:sign-off':
      return `Signed off ${item} as ${s(d.signerRoleLabel) ?? 'approver'}`
    case 'validation:sign-off-revoke':
      return `Revoked sign-off on ${item}${s(d.reason) ? ` — "${trim(s(d.reason), 60)}"` : ''}`
    case 'validation:evidence-attach':
      return `Attached evidence to ${item}${s(d.filename) ? ` — ${s(d.filename)}` : ''}`
    case 'validation:evidence-upload':
      return `Uploaded evidence for ${item}${s(d.filename) ? ` — ${s(d.filename)}` : ''}`
    case 'validation:evidence-detach':
      return `Detached evidence from ${item}`
    case 'validation:baseline-create': {
      const count = n(d.itemCount) ?? 0
      return `Baselined ${count} item${count === 1 ? '' : 's'} as "${trim(s(d.label), 60) || 'baseline'}"`
    }
    case 'validation:baseline-archive':
      return `Archived baseline "${trim(s(d.label), 60) || 'baseline'}"${
        s(d.reason) ? ` — ${trim(s(d.reason), 60)}` : ''
      }`
    case 'validation:baseline-restore':
      return `Restored baseline "${trim(s(d.label), 60) || 'baseline'}"`
    case 'validation:suspect-ack':
      return `Acknowledged suspect on ${item}${s(d.rationale) ? ` — "${trim(s(d.rationale), 60)}"` : ''}`
    case 'validation:settings-update':
      return 'Updated project validation settings'
    case 'validation:comment-create':
      return `Commented on ${item}`
    case 'validation:comment-update':
      return `Edited comment on ${item}`
    case 'validation:comment-delete':
      return `Deleted comment on ${item}`
    default:
      // Fall back to humanised action plus a short tail of details so unknown
      // actions remain readable rather than dumping raw JSON.
      return args.action.replace(/^validation:/, '').replace(/-/g, ' ')
  }
}
