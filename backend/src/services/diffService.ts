// NX-2 (#440) — REQ-M4 "Diff view between artefact versions".
//
// Pure, dependency-free diff primitives shared by the version-compare endpoint
// (version.controller.ts) and the baseline-diff endpoint (baseline.controller.ts).
//
// Two functions:
//   - fieldLevelDiff(a, b, fieldList)  — plain object comparison, one entry per
//     field, classified added / removed / changed / unchanged.
//   - lineDiff(before, after)          — a line-level LCS over a multi-line
//     string split on newlines, producing an op list (op: 'eq' | 'add' | 'del').
//
// Word-level intra-line highlighting is OUT OF SCOPE per the #440 Architecture
// comment — it is the only piece that would need a new npm dependency and is
// deferred as a fast-follow. The op-vocabulary here (eq/add/del) is forward-
// compatible: a future word-level pass refines an eq/add/del line into sub-spans
// without changing this response contract.
//
// .claude/rules.md §2 — ZERO new npm dependency. line-LCS is a standard
// algorithm in the same family as baseline.service.ts compareBaselineRoots' set
// diff; it is not the fragile word/character tokenisation gap-summary.md #7
// warns against.

/** A single line-level diff op. `text` is one line (no trailing newline). */
export interface LineDiffOp {
  op: 'eq' | 'add' | 'del'
  text: string
}

export type FieldChangeType = 'added' | 'removed' | 'changed' | 'unchanged'

/** A single field-level diff entry. */
export interface FieldDiff {
  name: string
  changeType: FieldChangeType
  before: string
  after: string
  /**
   * Line-level diff of `before` vs `after`. Only populated for fields named in
   * the caller's `multiLineFields` set whose changeType is `changed` — short
   * scalar fields (priority, status, …) do not carry one.
   */
  lineDiff?: LineDiffOp[]
}

/** Normalise any value to a comparable string. null/undefined collapse to ''. */
function toStr(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' ? v : String(v))).join(', ')
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Line-level LCS diff. Splits `before` and `after` on newlines, computes the
 * longest common subsequence of lines, and emits an ordered op list:
 *   - 'eq'  — line present in both
 *   - 'del' — line only in `before`
 *   - 'add' — line only in `after`
 *
 * Standard dynamic-programming LCS. Bounded by line count — for the realistic
 * sizes here (requirement / parameter descriptions) this is trivially cheap.
 * Identical inputs produce an all-`eq` list; both-empty produces a single empty
 * `eq` op.
 */
export function lineDiff(before: string, after: string): LineDiffOp[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const n = a.length
  const m = b.length

  // dp[i][j] = LCS length of a[i..] and b[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  // Walk the table to reconstruct the op list.
  const ops: LineDiffOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ op: 'eq', text: a[i] })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ op: 'del', text: a[i] })
      i++
    } else {
      ops.push({ op: 'add', text: b[j] })
      j++
    }
  }
  while (i < n) {
    ops.push({ op: 'del', text: a[i] })
    i++
  }
  while (j < m) {
    ops.push({ op: 'add', text: b[j] })
    j++
  }
  return ops
}

/**
 * Field-level diff of two records. For each field in `fieldList`, produce a
 * FieldDiff classified:
 *   - 'added'     — empty in A, non-empty in B
 *   - 'removed'   — non-empty in A, empty in B
 *   - 'changed'   — both non-empty, different
 *   - 'unchanged' — equal (including both-empty)
 *
 * A field named in `multiLineFields` whose changeType is `changed` additionally
 * carries a `lineDiff`.
 */
export function fieldLevelDiff(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  fieldList: readonly string[],
  multiLineFields: readonly string[] = [],
): FieldDiff[] {
  const multiLine = new Set(multiLineFields)
  return fieldList.map((name) => {
    const before = toStr(a[name])
    const after = toStr(b[name])

    let changeType: FieldChangeType
    if (before === after) {
      changeType = 'unchanged'
    } else if (before === '' && after !== '') {
      changeType = 'added'
    } else if (before !== '' && after === '') {
      changeType = 'removed'
    } else {
      changeType = 'changed'
    }

    const entry: FieldDiff = { name, changeType, before, after }
    if (changeType === 'changed' && multiLine.has(name)) {
      entry.lineDiff = lineDiff(before, after)
    }
    return entry
  })
}
