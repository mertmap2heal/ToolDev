import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Link as LinkIcon, Plus, X, ExternalLink, FileText, AlertCircle, GitPullRequest, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { issueService } from '../../services/issue.service'
import { requirementService } from '../../services/requirement.service'
import type { Issue, IssueLink } from 'shared/types/engineering.types'
import clsx from 'clsx'

interface IssueLinkedItemsProps {
  issue: Issue
  projectId: string
}

export default function IssueLinkedItems({ issue, projectId }: IssueLinkedItemsProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [isAdding, setIsAdding] = useState(false)
  const [linkType, setLinkType] = useState<'requirement' | 'issue' | 'function'>('requirement')
  const [selectedItemId, setSelectedItemId] = useState('')

  // Fetch requirements for linking
  const { data: requirementsData } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getRequirements(projectId)
      return response.success && Array.isArray(response.data) ? response.data : []
    },
    enabled: linkType === 'requirement',
  })

  const requirements = requirementsData || []

  // Create link mutation
  const createLinkMutation = useMutation({
    mutationFn: async (data: { linkedType: string; linkedId: string; linkType: string }) => {
      return issueService.createLink(projectId, issue.id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] })
      queryClient.invalidateQueries({ queryKey: ['issue-activity', projectId, issue.id] })
      setIsAdding(false)
      setSelectedItemId('')
    },
  })

  // Delete link mutation
  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      return issueService.deleteLink(projectId, linkId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] })
      queryClient.invalidateQueries({ queryKey: ['issue-activity', projectId, issue.id] })
    },
  })

  const handleAddLink = () => {
    if (selectedItemId) {
      const selectedRequirement = requirements.find((r: any) => r.id === selectedItemId)
      createLinkMutation.mutate({
        linkedType: linkType,
        linkedId: selectedItemId,
        linkType: 'related',
      })
    }
  }

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
    return `#${link.linkedId.slice(0, 8)}`
  }

  const getLinkTitle = (link: IssueLink) => {
    if (link.linkedType === 'requirement') {
      const req = requirements.find((r: any) => r.id === link.linkedId)
      return req?.title || link.linkedRequirementKey || 'Linked Requirement'
    }
    return (link as any).linkedTitle || `Linked ${link.linkedType}`
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <LinkIcon size={18} />
          Linked Items
          {issue.links && issue.links.length > 0 && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({issue.links.length})
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
              value={linkType}
              onChange={(e) => setLinkType(e.target.value as 'requirement' | 'issue' | 'function')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="requirement">Requirement</option>
              <option value="issue">Issue</option>
              <option value="function">Function</option>
            </select>
          </div>

          {linkType === 'requirement' && (
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

      {/* Linked items list */}
      {issue.links && issue.links.length > 0 ? (
        <div className="space-y-2">
          {issue.links.map((link) => (
            <div
              key={link.id}
              className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-500/50 dark:hover:border-blue-500/50 transition-all shadow-sm group"
            >
              <div className="mt-1 flex-shrink-0 p-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                {getIcon(link.linkedType)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                    {getDisplayId(link)}
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
      ) : (
        !isAdding && (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No linked items yet
          </p>
        )
      )}
    </div>
  )
}
