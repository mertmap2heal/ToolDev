import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Link as LinkIcon, Plus, X, ExternalLink, FileText, AlertCircle, GitPullRequest, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { issueService } from '../../services/issue.service'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { linkService } from '../../services/link.service'
import { buildDeepLink } from '../../linkage/buildDeepLink'
import type { Issue, IssueLink } from 'shared/types/engineering.types'
import type { EntityType } from 'shared/types/linkage.types'

const LINK_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'relates_to', label: 'Relates to' },
  { value: 'blocks', label: 'Blocks' },
  { value: 'blocked_by', label: 'Blocked by' },
  { value: 'duplicates', label: 'Duplicates' },
  { value: 'parent_of', label: 'Parent of' },
  { value: 'child_of', label: 'Child of' },
]

interface IssueLinkedItemsProps {
  issue: Issue
  projectId: string
}

export default function IssueLinkedItems({ issue, projectId }: IssueLinkedItemsProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [isAdding, setIsAdding] = useState(false)
  const [linkedType, setLinkedType] = useState<'requirement' | 'issue' | 'function'>('requirement')
  const [relationshipType, setRelationshipType] = useState('relates_to')
  const [selectedItemId, setSelectedItemId] = useState('')

  // Fetch requirements for linking
  const { data: requirementsData } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && Array.isArray(response.data) ? response.data : []
    },
    enabled: isAdding && linkedType === 'requirement',
  })

  const requirements = requirementsData || []

  const hasIssueLinks = issue.links?.some((l) => l.linkedType === 'issue')
  const hasFunctionLinks = issue.links?.some((l) => l.linkedType === 'function')

  // Fetch issues for linking and for displaying link titles
  const { data: issuesData } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      const response = await issueService.getIssues(projectId)
      return response.success && Array.isArray(response.data) ? response.data : []
    },
    enabled: (isAdding && linkedType === 'issue') || !!hasIssueLinks,
  })

  const issues = (issuesData || []).filter((i) => i.id !== issue.id)
  const allIssues = issuesData || []

  // Fetch functions for linking and for displaying link titles
  const { data: functionsData } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && Array.isArray(response.data) ? response.data : []
    },
    enabled: (isAdding && linkedType === 'function') || !!hasFunctionLinks,
  })

  const functions = functionsData || []

  // Incoming links (where this issue is the target) – bidirectional traceability
  const { data: incomingLinks = [] } = useQuery({
    queryKey: ['issue-incoming-links', projectId, issue.id],
    queryFn: async () => {
      const response = await linkService.getLinks(projectId, { targetId: issue.id, targetType: 'issue' })
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && !!issue.id,
  })

  // Create link mutation
  const createLinkMutation = useMutation({
    mutationFn: async (data: { linkedType: string; linkedId: string; linkType: string }) => {
      return issueService.createLink(projectId, issue.id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] })
      queryClient.invalidateQueries({ queryKey: ['issue-activity', projectId, issue.id] })
      queryClient.invalidateQueries({ queryKey: ['issue-incoming-links', projectId, issue.id] })
      setIsAdding(false)
      setSelectedItemId('')
    },
  })

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return issueService.deleteLink(projectId, linkId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] })
      queryClient.invalidateQueries({ queryKey: ['issue-activity', projectId, issue.id] })
      queryClient.invalidateQueries({ queryKey: ['issue-incoming-links', projectId, issue.id] })
    },
  })

  const handleAddLink = () => {
    if (selectedItemId) {
      createLinkMutation.mutate({
        linkedType,
        linkedId: selectedItemId,
        linkType: relationshipType,
      })
    }
  }

  const getRelationshipLabel = (linkTypeValue: string) =>
    LINK_TYPE_OPTIONS.find((o) => o.value === linkTypeValue)?.label || linkTypeValue.replace(/_/g, ' ')

  const getIcon = (type: string) => {
    switch (type) {
      case 'requirement': return <FileText size={16} className="text-blue-500" />
      case 'function': return <Settings size={16} className="text-green-500" />
      case 'issue': return <AlertCircle size={16} className="text-orange-500" />
      case 'change_request': return <GitPullRequest size={16} className="text-purple-500" />
      default: return <LinkIcon size={16} className="text-gray-500" />
    }
  }

  const getDisplayId = (link: IssueLink) => {
    if (link.linkedType === 'requirement') return link.linkedRequirementKey || `#${link.linkedId.slice(0, 8)}`
    if (link.linkedType === 'issue') {
      const i = allIssues.find((x: Issue) => x.id === link.linkedId)
      return i?.issueKey || `#${link.linkedId.slice(0, 8)}`
    }
    if (link.linkedType === 'function') {
      const f = functions.find((x: any) => x.id === link.linkedId)
      return f?.functionId || `#${link.linkedId.slice(0, 8)}`
    }
    return `#${link.linkedId.slice(0, 8)}`
  }

  const getLinkTitle = (link: IssueLink) => {
    if (link.linkedType === 'requirement') {
      const req = requirements.find((r: any) => r.id === link.linkedId)
      return req?.title || link.linkedRequirementKey || 'Linked Requirement'
    }
    if (link.linkedType === 'issue') {
      const linkedIssue = allIssues.find((i: Issue) => i.id === link.linkedId)
      return linkedIssue ? `${linkedIssue.issueKey || link.linkedId.slice(0, 8)}: ${linkedIssue.title}` : (link as any).linkedTitle || 'Linked Issue'
    }
    if (link.linkedType === 'function') {
      const func = functions.find((f: any) => f.id === link.linkedId)
      return func ? `${func.functionId || func.id.slice(0, 8)}: ${func.name}` : (link as any).linkedTitle || 'Linked Function'
    }
    return (link as any).linkedTitle || `Linked ${link.linkedType}`
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <LinkIcon size={18} />
          Linked Items
          {((issue.links?.length ?? 0) + incomingLinks.length) > 0 && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({(issue.links?.length ?? 0) + incomingLinks.length})
            </span>
          )}
        </h3>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Plus size={16} className="text-gray-600 dark:text-gray-400" />
          </button>
        )}
      </div>

      {/* Add link form */}
      {isAdding && (
        <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg space-y-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Link Type
            </label>
            <select
              value={linkedType}
              onChange={(e) => {
                setLinkedType(e.target.value as 'requirement' | 'issue' | 'function')
                setSelectedItemId('')
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="requirement">Requirement</option>
              <option value="issue">Issue</option>
              <option value="function">Function</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Relationship
            </label>
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {LINK_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {linkedType === 'requirement' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Requirement
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a requirement...</option>
                {requirements.map((req: any) => (
                  <option key={req.id} value={req.id}>
                    {req.requirementKey || `#${req.id.slice(0, 8)}`} - {req.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {linkedType === 'issue' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Issue
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose an issue...</option>
                {issues.map((i: Issue) => (
                  <option key={i.id} value={i.id}>
                    {i.issueKey || `#${i.id.slice(0, 8)}`} - {i.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {linkedType === 'function' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Function
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a function...</option>
                {functions.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.functionId || `#${f.id.slice(0, 8)}`} - {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddLink}
              disabled={!selectedItemId || createLinkMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createLinkMutation.isPending ? 'Adding...' : 'Add Link'}
            </button>
            <button
              onClick={() => {
                setIsAdding(false)
                setSelectedItemId('')
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Outgoing: this issue links to other items */}
      {issue.links && issue.links.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] uppercase text-gray-500 dark:text-gray-400 font-medium tracking-wider">Linked to (outgoing)</span>
          {issue.links.map((link) => (
            <div
              key={link.id}
              className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all shadow-sm group"
            >
              <div className="mt-1 flex-shrink-0 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                {getIcon(link.linkedType)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {getDisplayId(link)}
                  </span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {getRelationshipLabel(link.linkType)}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {getLinkTitle(link)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const path = link.linkedType === 'requirement'
                      ? `/projects/${projectId}/requirements?focusRequirementId=${link.linkedId}`
                      : link.linkedType === 'issue'
                        ? `/projects/${projectId}/issues/${link.linkedId}`
                        : `/projects/${projectId}/${link.linkedType}s/${link.linkedId}`
                    navigate(path)
                  }}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition-all"
                  title="Open linked item"
                >
                  <ExternalLink size={16} />
                </button>
                <button
                  onClick={() => deleteLinkMutation.mutate(link.id)}
                  disabled={deleteLinkMutation.isPending}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="Remove link"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Incoming: other items link to this issue (bidirectional) */}
      {incomingLinks.length > 0 && (
        <div className={issue.links && issue.links.length > 0 ? 'mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2' : 'space-y-2'}>
          <span className="text-[10px] uppercase text-amber-600 dark:text-amber-400 font-medium tracking-wider">Linked from (incoming)</span>
          {incomingLinks.map((link) => (
            <div
              key={link.id}
              className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all shadow-sm group"
            >
              <div className="mt-1 flex-shrink-0 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                {getIcon(link.sourceType)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] uppercase text-amber-600 dark:text-amber-400 font-medium">Incoming</span>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {link.sourceDisplayId || link.sourceId.slice(0, 8)}
                  </span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300">
                    {link.sourceType}
                  </span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {String(link.linkType).replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {link.sourceTitle || link.sourceDescription || 'Linked item'}
                </div>
              </div>
              <a
                href={buildDeepLink(projectId, { type: link.sourceType as EntityType, id: link.sourceId })}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg transition-all"
                title="Open linked item"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          ))}
        </div>
      )}

      {!isAdding && (!issue.links || issue.links.length === 0) && incomingLinks.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No linked items yet
        </p>
      )}
    </div>
  )
}
