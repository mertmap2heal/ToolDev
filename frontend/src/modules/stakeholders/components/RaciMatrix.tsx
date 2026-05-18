import { useState, useMemo, useEffect, useRef } from 'react'
import { Plus, AlertTriangle, X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listRaciEntries,
  createRaciEntry,
  deleteRaciEntry,
  setRaciAssignments,
  listSubjectOptions,
  type RaciEntry,
  type RaciLetter,
  type RaciSubjectType,
  type SubjectOption,
} from '../../../services/stakeholders.service'
import { getProjectUsersWithRoles } from '../../../services/stakeholderRoles.service'
import type { StakeholderUser } from '../../../types/admin.types'

const SUBJECT_TYPES: RaciSubjectType[] = [
  'SystemFunction',
  'Requirement',
  'CertObjective',
  'Component',
  'Deliverable',
]
const LETTERS: RaciLetter[] = ['R', 'A', 'C', 'I']

interface RaciMatrixProps {
  projectId: string
  onShowToast: (msg: string) => void
  canEdit: boolean
}

/** The chip class for one RACI letter (§9 — the letter is the text, never colour-only). */
function letterChipClass(letter: RaciLetter): string {
  switch (letter) {
    case 'A':
      return 'bg-status-success/12 text-status-success font-semibold'
    case 'R':
      return 'border border-strong text-ink-primary'
    case 'C':
      return 'text-ink-muted'
    case 'I':
      return 'text-ink-faint'
  }
}

/**
 * NX-8 (#463): the RACI matrix — design-system.md §6.2 grid. Rows = subjects,
 * columns = project users. Each cell is an R/A/C/I letter chip. The grid is a
 * real <table> with role="grid"; arrow keys move the focused cell, Enter/Space
 * opens the cell editor popover, Escape closes it. Tokens only.
 */
export default function RaciMatrix({ projectId, onShowToast, canEdit }: RaciMatrixProps) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  // The cell editor popover: which (raciId, userId) is being edited.
  const [editCell, setEditCell] = useState<{ raciId: string; userId: string } | null>(null)
  // Roving-focus cell coordinate (row, col) for keyboard nav.
  const [focusCell, setFocusCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 })
  const gridRef = useRef<HTMLTableElement>(null)

  const { data: entries = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['raci', projectId],
    queryFn: () => listRaciEntries(projectId),
    enabled: !!projectId,
  })
  const { data: users = [] } = useQuery({
    queryKey: ['project', projectId, 'usersWithRoles'],
    queryFn: () => getProjectUsersWithRoles(projectId),
    enabled: !!projectId,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['raci', projectId] })

  const deleteMut = useMutation({
    mutationFn: (raciId: string) => deleteRaciEntry(projectId, raciId),
    onSuccess: () => {
      invalidate()
      onShowToast('RACI entry deleted.')
    },
    onError: (e: Error) => onShowToast(e.message),
  })

  const setAssignmentsMut = useMutation({
    mutationFn: (args: { raciId: string; assignments: { userId: string; letter: RaciLetter }[] }) =>
      setRaciAssignments(projectId, args.raciId, args.assignments),
    onSuccess: (result) => {
      invalidate()
      setEditCell(null)
      if (result.warnings.length > 0) onShowToast(result.warnings[0])
      else onShowToast('RACI updated.')
    },
    onError: (e: Error) => onShowToast(e.message),
  })

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id

  /** The current letter set for (raciId, userId). */
  const lettersFor = (entry: RaciEntry, userId: string): RaciLetter[] =>
    entry.assignments.filter((a) => a.userId === userId).map((a) => a.letter)

  // Move the focused cell with arrow keys; open the editor on Enter/Space.
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const rows = entries.length
    const cols = users.length
    if (rows === 0 || cols === 0) return
    let { r, c } = focusCell
    if (e.key === 'ArrowRight') c = Math.min(cols - 1, c + 1)
    else if (e.key === 'ArrowLeft') c = Math.max(0, c - 1)
    else if (e.key === 'ArrowDown') r = Math.min(rows - 1, r + 1)
    else if (e.key === 'ArrowUp') r = Math.max(0, r - 1)
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (canEdit) {
        setEditCell({ raciId: entries[focusCell.r].id, userId: users[focusCell.c].id })
      }
      return
    } else if (e.key === 'Escape') {
      setEditCell(null)
      return
    } else {
      return
    }
    e.preventDefault()
    setFocusCell({ r, c })
    const cell = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)
    cell?.focus()
  }

  if (isLoading) {
    return (
      <div className="border border-default rounded-md p-8 text-sm text-ink-muted">
        Loading the RACI matrix…
      </div>
    )
  }
  if (isError) {
    return (
      <div className="border border-default rounded-md p-8 text-sm text-status-danger">
        Could not load the RACI matrix — retry, or check your connection.{' '}
        <button type="button" onClick={() => refetch()} className="underline text-accent-primary">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          Rows are subjects, columns are project members. Each cell is the assigned R / A / C / I.
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-sm text-sm"
          >
            <Plus size={14} />
            Create RACI entry
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="border border-default rounded-md p-8 text-center">
          <p className="text-sm text-ink-muted">
            No RACI entries. Pick a system function, requirement, or certification objective and
            assign Responsible, Accountable, Consulted, Informed.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-sm text-sm"
            >
              <Plus size={14} />
              Create RACI entry
            </button>
          )}
        </div>
      ) : users.length === 0 ? (
        <div className="border border-default rounded-md p-8 text-sm text-ink-muted">
          No project members yet. Add members in the Directory before assigning RACI.
        </div>
      ) : (
        <div className="bg-surface-base border border-default rounded-md overflow-x-auto">
          <table
            ref={gridRef}
            role="grid"
            aria-label="RACI responsibility matrix"
            className="w-full text-sm border-collapse"
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  className="px-3 py-2 text-left text-ink-muted font-medium border-b border-default sticky left-0 bg-surface-raised"
                >
                  Subject
                </th>
                {users.map((u) => (
                  <th
                    key={u.id}
                    scope="col"
                    className="px-3 py-2 text-left text-ink-muted font-medium border-b border-default whitespace-nowrap bg-surface-raised"
                  >
                    {u.name}
                  </th>
                ))}
                {canEdit && (
                  <th
                    scope="col"
                    className="px-3 py-2 border-b border-default bg-surface-raised"
                    aria-label="Actions"
                  />
                )}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, rIdx) => (
                <tr key={entry.id}>
                  <th
                    scope="row"
                    className="px-3 py-2 text-left font-medium text-ink-primary border-b border-default border-l-4 bg-surface-base"
                    style={{
                      borderLeftColor: entry.riskFlag
                        ? 'var(--status-danger)'
                        : 'var(--border-default)',
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {entry.riskFlag && (
                        <AlertTriangle size={14} className="text-status-warning" aria-hidden />
                      )}
                      <span>
                        <span className="text-ink-muted text-xs">{entry.subjectType}</span>
                        <br />
                        <SubjectLabel
                          projectId={projectId}
                          subjectType={entry.subjectType}
                          subjectId={entry.subjectId}
                        />
                      </span>
                    </span>
                  </th>
                  {users.map((u, cIdx) => {
                    const ls = lettersFor(entry, u.id)
                    const isFocused = focusCell.r === rIdx && focusCell.c === cIdx
                    return (
                      <td
                        key={u.id}
                        role="gridcell"
                        data-cell={`${rIdx}-${cIdx}`}
                        tabIndex={isFocused ? 0 : -1}
                        aria-label={`${userName(u.id)} on ${entry.subjectType}: ${
                          ls.length > 0 ? ls.join(', ') : 'unassigned'
                        }`}
                        onFocus={() => setFocusCell({ r: rIdx, c: cIdx })}
                        onKeyDown={onGridKeyDown}
                        onClick={() => {
                          setFocusCell({ r: rIdx, c: cIdx })
                          if (canEdit) setEditCell({ raciId: entry.id, userId: u.id })
                        }}
                        className={`px-3 py-2 border-b border-default text-center ${
                          canEdit ? 'cursor-pointer hover:bg-surface-raised' : ''
                        } ${isFocused ? 'outline outline-2 outline-accent-primary' : ''}`}
                      >
                        {ls.length > 0 ? (
                          <span className="inline-flex gap-1">
                            {ls.map((l) => (
                              <span
                                key={l}
                                className={`inline-flex items-center justify-center w-5 h-5 rounded-xs text-xs ${letterChipClass(
                                  l
                                )}`}
                              >
                                {l}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-ink-faint" aria-hidden>
                            ·
                          </span>
                        )}
                      </td>
                    )
                  })}
                  {canEdit && (
                    <td className="px-3 py-2 border-b border-default text-center">
                      <button
                        type="button"
                        onClick={() => deleteMut.mutate(entry.id)}
                        className="p-1 text-status-danger hover:bg-surface-inset rounded-sm"
                        aria-label={`Delete RACI entry for ${entry.subjectType}`}
                      >
                        <X size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cell editor popover — the four-letter toggle */}
      {editCell && (
        <CellEditorPopover
          entry={entries.find((e) => e.id === editCell.raciId)!}
          userId={editCell.userId}
          userName={userName(editCell.userId)}
          saving={setAssignmentsMut.isPending}
          onClose={() => setEditCell(null)}
          onSave={(letters) => {
            const entry = entries.find((e) => e.id === editCell.raciId)!
            // Rebuild the full assignment set: keep every other user, replace
            // this user's letters with the chosen set.
            const others = entry.assignments
              .filter((a) => a.userId !== editCell.userId)
              .map((a) => ({ userId: a.userId, letter: a.letter }))
            const mine = letters.map((l) => ({ userId: editCell.userId, letter: l }))
            setAssignmentsMut.mutate({ raciId: entry.id, assignments: [...others, ...mine] })
          }}
        />
      )}

      {createOpen && (
        <CreateRaciModal
          projectId={projectId}
          users={users}
          onClose={() => setCreateOpen(false)}
          onCreated={(warnings) => {
            qc.invalidateQueries({ queryKey: ['raci', projectId] })
            setCreateOpen(false)
            if (warnings.length > 0) onShowToast(warnings[0])
            else onShowToast('RACI entry created.')
          }}
        />
      )}
    </div>
  )
}

// --- Subject label (resolves the polymorphic subject to a display name) ------

function SubjectLabel({
  projectId,
  subjectType,
  subjectId,
}: {
  projectId: string
  subjectType: RaciSubjectType
  subjectId: string
}) {
  const { data: options = [] } = useQuery({
    queryKey: ['raci-subjects', projectId, subjectType],
    queryFn: () => listSubjectOptions(projectId, subjectType),
    enabled: subjectType !== 'Deliverable',
  })
  if (subjectType === 'Deliverable') return <span className="text-ink-primary">{subjectId}</span>
  const match = options.find((o) => o.id === subjectId)
  return (
    <span className="text-ink-primary">
      {match ? match.label : <span className="text-ink-faint italic">subject removed</span>}
    </span>
  )
}

// --- Cell editor popover -----------------------------------------------------

function CellEditorPopover({
  entry,
  userId,
  userName,
  saving,
  onClose,
  onSave,
}: {
  entry: RaciEntry
  userId: string
  userName: string
  saving: boolean
  onClose: () => void
  onSave: (letters: RaciLetter[]) => void
}) {
  const initial = entry.assignments.filter((a) => a.userId === userId).map((a) => a.letter)
  const [selected, setSelected] = useState<Set<RaciLetter>>(new Set(initial))

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const toggle = (l: RaciLetter) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(l)) next.delete(l)
      else next.add(l)
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Edit RACI cell"
    >
      <div className="bg-surface-base rounded-lg border border-default w-full max-w-sm mx-4">
        <div className="flex items-center justify-between p-4 border-b border-default">
          <h3 className="text-sm font-medium text-ink-primary">
            {userName} — {entry.subjectType}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-surface-inset rounded-sm"
            aria-label="Close"
          >
            <X size={16} className="text-ink-muted" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {LETTERS.map((l) => (
            <label key={l} className="flex items-center gap-2 text-sm text-ink-primary">
              <input
                type="checkbox"
                checked={selected.has(l)}
                onChange={() => toggle(l)}
                className="rounded-sm border-default"
              />
              <span className="font-semibold w-4">{l}</span>
              <span className="text-ink-muted">
                {l === 'R' && 'Responsible'}
                {l === 'A' && 'Accountable'}
                {l === 'C' && 'Consulted'}
                {l === 'I' && 'Informed'}
              </span>
            </label>
          ))}
        </div>
        <div className="p-4 border-t border-default flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-default text-ink-primary rounded-sm hover:bg-surface-raised text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave([...selected])}
            className="px-3 py-1.5 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-sm disabled:opacity-50 text-sm"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Create RACI entry modal -------------------------------------------------

function CreateRaciModal({
  projectId,
  users,
  onClose,
  onCreated,
}: {
  projectId: string
  users: StakeholderUser[]
  onClose: () => void
  onCreated: (warnings: string[]) => void
}) {
  const [subjectType, setSubjectType] = useState<RaciSubjectType>('Requirement')
  const [subjectId, setSubjectId] = useState('')
  // assignments keyed by userId -> set of letters
  const [assignments, setAssignments] = useState<Record<string, Set<RaciLetter>>>({})
  const [error, setError] = useState<string | null>(null)

  const { data: subjectOptions = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['raci-subjects', projectId, subjectType],
    queryFn: () => listSubjectOptions(projectId, subjectType),
    enabled: subjectType !== 'Deliverable',
  })

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const createMut = useMutation({
    mutationFn: () => {
      const flat = Object.entries(assignments).flatMap(([userId, letters]) =>
        [...letters].map((letter) => ({ userId, letter }))
      )
      return createRaciEntry(projectId, {
        subjectType,
        subjectId: subjectId.trim(),
        assignments: flat,
      })
    },
    onSuccess: (result) => onCreated(result.warnings),
    onError: (e: Error) => setError(e.message),
  })

  const toggleAssignment = (userId: string, letter: RaciLetter) => {
    setAssignments((prev) => {
      const next = { ...prev }
      const set = new Set(next[userId] ?? [])
      if (set.has(letter)) set.delete(letter)
      else set.add(letter)
      if (set.size === 0) delete next[userId]
      else next[userId] = set
      return next
    })
  }

  const accountableCount = Object.values(assignments).filter((s) => s.has('A')).length

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-surface-base rounded-lg border border-default w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-default">
          <h2 className="text-xl font-medium text-ink-primary">Create RACI entry</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-surface-inset rounded-sm"
            aria-label="Close"
          >
            <X size={18} className="text-ink-muted" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <p className="text-sm text-status-danger" role="alert">
              {error}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-ink-primary mb-1">Subject type</label>
            <select
              value={subjectType}
              onChange={(e) => {
                setSubjectType(e.target.value as RaciSubjectType)
                setSubjectId('')
              }}
              className="w-full px-3 py-2 border border-default rounded-sm bg-surface-base text-ink-primary text-sm"
            >
              {SUBJECT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-primary mb-1">Subject</label>
            {subjectType === 'Deliverable' ? (
              <input
                type="text"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                placeholder="Deliverable name or reference"
                className="w-full px-3 py-2 border border-default rounded-sm bg-surface-base text-ink-primary text-sm"
              />
            ) : (
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 border border-default rounded-sm bg-surface-base text-ink-primary text-sm"
              >
                <option value="">{subjectsLoading ? 'Loading…' : 'Select…'}</option>
                {subjectOptions.map((o: SubjectOption) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <span className="block text-sm font-medium text-ink-primary mb-2">
              Assignments — at least one Accountable
            </span>
            {accountableCount === 0 && (
              <p className="text-xs text-status-danger mb-2">
                A RACI entry needs at least one Accountable.
              </p>
            )}
            {accountableCount > 1 && (
              <p className="text-xs text-status-warning mb-2">
                Multiple Accountable assigned — RACI doctrine prefers exactly one.
              </p>
            )}
            <div className="border border-default rounded-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-raised">
                    <th className="px-2 py-1 text-left text-ink-muted font-medium">Member</th>
                    {LETTERS.map((l) => (
                      <th key={l} className="px-2 py-1 text-center text-ink-muted font-medium">
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-default">
                      <td className="px-2 py-1 text-ink-primary">{u.name}</td>
                      {LETTERS.map((l) => (
                        <td key={l} className="px-2 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={assignments[u.id]?.has(l) ?? false}
                            onChange={() => toggleAssignment(u.id, l)}
                            className="rounded-sm border-default"
                            aria-label={`${u.name} ${l}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-default flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-default text-ink-primary rounded-sm hover:bg-surface-raised text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!subjectId.trim() || createMut.isPending}
            onClick={() => {
              setError(null)
              createMut.mutate()
            }}
            className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-sm disabled:opacity-50 text-sm"
          >
            {createMut.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
