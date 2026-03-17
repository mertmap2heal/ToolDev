import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { linkService } from '../../services/link.service'
import { invalidateLinkCaches } from '../../utils/invalidateLinkCaches'
import { buildDeepLink } from '../../linkage/buildDeepLink'
import type { Link, CreateLinkDto, LinkType } from 'shared/types/linkage.types'
import { Plus, Trash2, ExternalLink, AlertCircle } from 'lucide-react'

interface FunctionTraceabilityTabProps {
  funcId: string
  projectId: string
}

const LINK_TYPE_OPTIONS: { value: LinkType; label: string }[] = [
  { value: 'satisfies', label: 'Satisfies (Requirement)' },
  { value: 'derived_from', label: 'Derived From (Requirement)' },
  { value: 'allocated_to', label: 'Allocated To (PBS)' },
  { value: 'verified_by', label: 'Verified By (Test)' },
  { value: 'tracked_by', label: 'Tracked By (Issue)' },
  { value: 'changes_via', label: 'Changed By (CR)' },
  { value: 'mitigates', label: 'Mitigates (Hazard/Risk)' },
  { value: 'implemented_by', label: 'Implemented By (Task)' },
  { value: 'related_interface', label: 'Related Interface' },
  { value: 'refines', label: 'Refines (Function)' },
]

export default function FunctionTraceabilityTab({ funcId, projectId }: FunctionTraceabilityTabProps) {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<Partial<CreateLinkDto>>({ sourceType: 'function', sourceId: funcId })
  const { data: outgoingLinks = [] } = useQuery({
    queryKey: ['function-trace-links-outgoing', projectId, funcId],
    queryFn: async () => {
      const res = await linkService.getLinks(projectId, { sourceId: funcId })
      return res.success && res.data ? res.data : []
    },
    enabled: !!funcId && !!projectId,
  })
  const { data: incomingLinks = [] } = useQuery({
    queryKey: ['function-trace-links-incoming', projectId, funcId],
    queryFn: async () => {
      const res = await linkService.getLinks(projectId, { targetId: funcId })
      return res.success && res.data ? res.data : []
    },
    enabled: !!funcId && !!projectId,
  })
  const links = [...outgoingLinks, ...incomingLinks]

  const createMutation = useMutation({
    mutationFn: (dto: CreateLinkDto) => linkService.createLink(projectId, dto),
    onSuccess: () => {
      invalidateLinkCaches(queryClient, projectId)
      setShowAdd(false)
      setForm({ sourceType: 'function', sourceId: funcId })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (linkId: string) => linkService.deleteLink(projectId, linkId),
    onSuccess: () => {
      invalidateLinkCaches(queryClient, projectId)
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <AlertCircle size={13} className="text-blue-500" />
          Traceability Links ({links.length})
        </h4>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <Plus size={12} /> Add Link
        </button>
      </div>
      {showAdd && (
        <form
          className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700/50 mb-4 flex flex-col gap-2"
          onSubmit={e => {
            e.preventDefault()
            if (form.sourceType && form.sourceId && form.targetType && form.targetId && form.linkType) {
              createMutation.mutate(form as CreateLinkDto)
            }
          }}
        >
          <div className="flex gap-2">
            <select
              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={form.linkType || ''}
              onChange={e => setForm(f => ({ ...f, linkType: e.target.value as LinkType }))}
              required
            >
              <option value="">Select link type</option>
              {LINK_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Target Type (e.g. requirement, function, pbs_component)"
              value={form.targetType || ''}
              onChange={e => setForm(f => ({ ...f, targetType: e.target.value }))}
              required
            />
            <input
              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Target ID"
              value={form.targetId || ''}
              onChange={e => setForm(f => ({ ...f, targetId: e.target.value }))}
              required
            />
            <input
              className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Rationale (optional)"
              value={form.rationale || ''}
              onChange={e => setForm(f => ({ ...f, rationale: e.target.value }))}
            />
            <button
              type="submit"
              className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
              disabled={createMutation.isPending}
            >
              Add
            </button>
          </div>
        </form>
      )}
      {links.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">No traceability links.</p>
      ) : (
        <div className="space-y-2">
          {links.map(link => {
            const isIncoming = link.targetId === funcId
            const entityType = isIncoming ? link.sourceType : link.targetType
            const entityId = isIncoming ? link.sourceId : link.targetId
            const entityDisplayId = isIncoming ? link.sourceDisplayId : link.targetDisplayId
            const entityTitle = isIncoming ? link.sourceTitle : link.targetTitle
            const entityDescription = isIncoming ? link.sourceDescription : link.targetDescription
            return (
              <div key={link.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700/50 hover:border-gray-200 dark:hover:border-gray-600 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isIncoming && (
                      <span className="text-[10px] uppercase text-amber-600 dark:text-amber-400 font-medium">Incoming</span>
                    )}
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{link.linkType}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {entityType}
                    </span>
                    <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                      {entityDisplayId || entityId}
                    </span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                      {entityTitle || entityDescription || ''}
                    </span>
                    {link.isSuspect && (
                      <span className="ml-2 text-xs text-orange-600 dark:text-orange-400 font-semibold">Suspect</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={buildDeepLink(projectId, { type: entityType, id: entityId })}
                    className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open linked entity"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    onClick={() => deleteMutation.mutate(link.id)}
                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    title="Delete link"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
