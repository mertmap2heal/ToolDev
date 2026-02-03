import { useState, useMemo } from 'react'
import { Plus, X, MessageSquare, ExternalLink } from 'lucide-react'
import type { Request, RequestStatus, RequestPriority, RequestType } from '../types'
import { useStakeholdersStore } from '../store'
import PlaceholderLinkModal from './PlaceholderLinkModal'

interface RequestsBoardProps {
  onShowToast: (msg: string) => void
  canEdit: boolean
}

const STATUSES: RequestStatus[] = ['Open', 'Accepted', 'InProgress', 'Done', 'Blocked', 'Cancelled']
const PRIORITIES: RequestPriority[] = ['Low', 'Medium', 'High']
const TYPES: RequestType[] = ['Review', 'Approval', 'Response', 'Info', 'ActionItem']

export default function RequestsBoard({ onShowToast, canEdit }: RequestsBoardProps) {
  const { state, dispatch, nextRequestId, nextCommentId } = useStakeholdersStore()
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [detailRequest, setDetailRequest] = useState<Request | null>(null)
  const [placeholderLinkOpen, setPlaceholderLinkOpen] = useState(false)
  const [newComment, setNewComment] = useState('')

  const getStakeholderName = (id: string) => state.stakeholders.find((s) => s.stakeholderId === id)?.displayName ?? id
  const getGroupName = (id: string) => state.committees.find((c) => c.groupId === id)?.name ?? id

  const filtered = useMemo(() => {
    let list = state.requests
    if (statusFilter.size > 0) list = list.filter((r) => statusFilter.has(r.status))
    if (priorityFilter.size > 0) list = list.filter((r) => priorityFilter.has(r.priority))
    return list
  }, [state.requests, statusFilter, priorityFilter])

  const isOverdue = (r: Request) => r.dueDate && new Date(r.dueDate) < new Date() && !['Done', 'Cancelled'].includes(r.status)
  const isDueSoon = (r: Request) => {
    if (!r.dueDate || ['Done', 'Cancelled'].includes(r.status)) return false
    const due = new Date(r.dueDate)
    const in3 = new Date(Date.now() + 3 * 86400000)
    return due <= in3 && due >= new Date()
  }

  const handleAddComment = () => {
    if (!detailRequest || !newComment.trim()) return
    dispatch({
      type: 'ADD_REQUEST_COMMENT',
      payload: {
        id: nextCommentId(),
        requestId: detailRequest.requestId,
        author: state.role,
        text: newComment.trim(),
        createdAt: new Date().toISOString(),
      },
    })
    setNewComment('')
    onShowToast('Comment added.')
  }

  const comments = detailRequest
    ? state.requestComments.filter((c) => c.requestId === detailRequest.requestId)
    : []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</span>
          {STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={statusFilter.has(s)}
                onChange={() =>
                  setStatusFilter((prev) => {
                    const next = new Set(prev)
                    if (next.has(s)) next.delete(s)
                    else next.add(s)
                    return next
                  })
                }
                className="rounded border-gray-300 dark:border-gray-600"
              />
              {s}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Priority</span>
          {PRIORITIES.map((p) => (
            <label key={p} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={priorityFilter.has(p)}
                onChange={() =>
                  setPriorityFilter((prev) => {
                    const next = new Set(prev)
                    if (next.has(p)) next.delete(p)
                    else next.add(p)
                    return next
                  })
                }
                className="rounded border-gray-300 dark:border-gray-600"
              />
              {p}
            </label>
          ))}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            <Plus size={16} />
            Create request
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm text-gray-900 dark:text-white">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">ID</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Title</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Type</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Priority</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Target</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((r) => (
              <tr
                key={r.requestId}
                onClick={() => setDetailRequest(r)}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td className="px-4 py-2 font-mono text-xs text-gray-900 dark:text-white">{r.requestId}</td>
                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                  {r.title}
                  {isOverdue(r) && (
                    <span className="ml-2 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-xs">
                      Overdue
                    </span>
                  )}
                  {isDueSoon(r) && !isOverdue(r) && (
                    <span className="ml-2 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs">
                      Due soon
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{r.type}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{r.priority}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{r.status}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">
                  {r.targetType === 'Stakeholder' ? getStakeholderName(r.targetId) : getGroupName(r.targetId)}
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.dueDate ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No requests match the filters.</p>
        )}
      </div>

      {createOpen && (
        <CreateRequestModal
          onClose={() => setCreateOpen(false)}
          onSave={(req) => {
            dispatch({ type: 'CREATE_REQUEST', payload: req })
            onShowToast('Request created.')
            setCreateOpen(false)
          }}
          nextRequestId={nextRequestId}
          stakeholders={state.stakeholders}
          committees={state.committees}
          createdBy={state.role}
        />
      )}

      {detailRequest && (
        <RequestDetailDrawer
          request={detailRequest}
          onClose={() => setDetailRequest(null)}
          comments={comments}
          newComment={newComment}
          setNewComment={setNewComment}
          onAddComment={handleAddComment}
          onStatusChange={(status) => {
            dispatch({
              type: 'UPDATE_REQUEST',
              payload: { ...detailRequest, status, updatedAt: new Date().toISOString() },
            })
            setDetailRequest((r) => (r ? { ...r, status, updatedAt: new Date().toISOString() } : null))
            onShowToast('Status updated.')
          }}
          getTargetName={(type, id) =>
            type === 'Stakeholder' ? getStakeholderName(id) : getGroupName(id)
          }
          onOpenLinkedObject={() => setPlaceholderLinkOpen(true)}
          canEdit={canEdit}
        />
      )}

      {placeholderLinkOpen && (
        <PlaceholderLinkModal
          isOpen={true}
          onClose={() => setPlaceholderLinkOpen(false)}
          title="Open linked object"
          moduleName="Relevant module"
          filterKey="id"
          filterValue={detailRequest?.linkedObject?.id ?? '—'}
          previewColumns={['ID', 'Label', 'Status']}
          previewRows={[
            { ID: detailRequest?.linkedObject?.id ?? '—', Label: detailRequest?.title ?? '—', Status: detailRequest?.status ?? '—' },
          ]}
          onPlaceholderNavigate={() => onShowToast('Go to module is a placeholder.')}
        />
      )}
    </div>
  )
}

interface CreateRequestModalProps {
  onClose: () => void
  onSave: (req: Request) => void
  nextRequestId: () => string
  stakeholders: { stakeholderId: string; displayName: string }[]
  committees: { groupId: string; name: string }[]
  createdBy: string
}

function CreateRequestModal({
  onClose,
  onSave,
  nextRequestId,
  stakeholders,
  committees,
  createdBy,
}: CreateRequestModalProps) {
  const [targetType, setTargetType] = useState<'Stakeholder' | 'Group'>('Stakeholder')
  const [targetId, setTargetId] = useState('')
  const [type, setType] = useState<RequestType>('Approval')
  const [priority, setPriority] = useState<RequestPriority>('Medium')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [dueDate, setDueDate] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const now = new Date().toISOString()
    onSave({
      requestId: nextRequestId(),
      type,
      priority,
      status: 'Open',
      targetType,
      targetId,
      title,
      message,
      dueDate: dueDate || undefined,
      linkedObject: { kind: 'Baseline', id: 'BL-placeholder' },
      createdBy,
      createdAt: now,
      updatedAt: now,
    })
  }

  const targetOptions = targetType === 'Stakeholder' ? stakeholders : committees

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose} role="dialog">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create request</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target type</label>
            <select value={targetType} onChange={(e) => setTargetType(e.target.value as 'Stakeholder' | 'Group')} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="Stakeholder">Stakeholder</option>
              <option value="Group">Group</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
              <option value="">Select…</option>
              {targetOptions.map((o) => (
                <option key={('stakeholderId' in o ? o.stakeholderId : o.groupId)} value={'stakeholderId' in o ? o.stakeholderId : o.groupId}>
                  {'displayName' in o ? o.displayName : o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as RequestType)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as RequestPriority)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Create</button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface RequestDetailDrawerProps {
  request: Request
  onClose: () => void
  comments: { author: string; text: string; createdAt: string }[]
  newComment: string
  setNewComment: (v: string) => void
  onAddComment: () => void
  onStatusChange: (status: RequestStatus) => void
  getTargetName: (type: string, id: string) => string
  onOpenLinkedObject: () => void
  canEdit: boolean
}

function RequestDetailDrawer({
  request,
  onClose,
  comments,
  newComment,
  setNewComment,
  onAddComment,
  onStatusChange,
  getTargetName,
  onOpenLinkedObject,
  canEdit,
}: RequestDetailDrawerProps) {
  return (
    <div
      className="fixed right-0 top-0 z-40 w-full max-w-xl min-w-[28rem] h-[calc(100vh-4rem)] top-16 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
      role="region"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <div className="font-mono text-sm text-gray-500 dark:text-gray-400">{request.requestId}</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{request.title}</h2>
        </div>
        <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</span>
          {canEdit ? (
            <select
              value={request.status}
              onChange={(e) => onStatusChange(e.target.value as RequestStatus)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{request.status}</p>
          )}
        </div>
        <div>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Target</span>
          <p className="mt-1 text-sm text-gray-900 dark:text-white">{getTargetName(request.targetType, request.targetId)}</p>
        </div>
        <div>
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Message</span>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{request.message}</p>
        </div>
        {request.linkedObject && (
          <div>
            <button type="button" onClick={onOpenLinkedObject} className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
              <ExternalLink size={14} />
              Open linked object ({request.linkedObject.kind}: {request.linkedObject.id})
            </button>
          </div>
        )}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <MessageSquare size={16} />
            Comments
          </h3>
          <ul className="space-y-2 mb-3">
            {comments.map((c, i) => (
              <li key={i} className="text-sm p-2 bg-gray-50 dark:bg-gray-900 rounded">
                <span className="font-medium text-gray-700 dark:text-gray-300">{c.author}</span>
                <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">{c.createdAt.slice(0, 10)}</span>
                <p className="mt-1 text-gray-700 dark:text-gray-300">{c.text}</p>
              </li>
            ))}
          </ul>
          {canEdit && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              />
              <button type="button" onClick={onAddComment} disabled={!newComment.trim()} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50">
                Add
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
