import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Edit2,
  Link as LinkIcon,
  Bell,
  BellOff,
  MoreVertical,
  X,
  Check,
  Copy,
  Loader2
} from 'lucide-react'
import { issueService } from '../../services/issue.service'
import { authService } from '../../services/auth.service'
import { errorMessage } from '../../utils/errorMessage'

import IssueActivityFeed from '../../components/issues/IssueActivityFeed'
import IssueCommentComposer from '../../components/issues/IssueCommentComposer'
import IssueSidebar from '../../components/issues/IssueSidebar'
import IssueLinkedItems from '../../components/issues/IssueLinkedItems'
import IssueDescriptionEditor from '../../components/issues/IssueDescriptionEditor'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'
import type { Issue, IssueType } from 'shared/types/engineering.types'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

const ISSUE_TYPE_LABELS: Record<string, string> = {
  specification_error: 'Specification Error',
  design_error: 'Design Error',
  coding_error: 'Coding Error',
  documentation_error: 'Documentation Error',
  interface_error: 'Interface Error',
  other: 'Other',
}

export default function IssueDetailPage() {
  const { projectId, issueId } = useParams<{ projectId: string; issueId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState(false)

  // Fetch issue detail
  const { data: issueData, isLoading, isError } = useQuery({
    queryKey: ['issue', projectId, issueId],
    queryFn: async () => {
      if (!projectId || !issueId) throw new Error('Missing params')
      const response = await issueService.getIssue(projectId, issueId)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to load issue')
    },
    enabled: !!projectId && !!issueId,
    retry: false,
  })

  const issue = issueData
  const issueNotFound = !isLoading && (isError || (!issue && !!issueId))

  // Fetch current user
  const { data: currentUserData } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const response = await authService.getCurrentUser()
      return response.success ? response.data : null
    },
  })

  const currentUser = currentUserData

  // Check if user is subscribed
  const isSubscribed = issue?.subscribers?.some(s => s.id === currentUser?.id)

  useEffect(() => {
    if (issue) {
      setTitleValue(issue.title)
    }
  }, [issue])

  // Update title mutation
  const updateTitleMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!projectId || !issueId) throw new Error('Missing params')
      return issueService.updateIssue(projectId, issueId, { title })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      setIsEditingTitle(false)
    },
  })

  // Update status mutation (close/reopen)
  const updateStatusMutation = useMutation({
    mutationFn: async (status: Issue['status']) => {
      if (!projectId || !issueId) throw new Error('Missing params')
      return issueService.updateIssue(projectId, issueId, { status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
    },
  })

  // Subscribe/unsubscribe mutation
  const toggleSubscriptionMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !issueId) throw new Error('Missing params')
      if (isSubscribed) {
        return issueService.unsubscribe(projectId, issueId)
      } else {
        return issueService.subscribe(projectId, issueId)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
    },
  })

  // Delete issue mutation
  const deleteIssueMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !issueId) throw new Error('Missing params')
      return issueService.deleteIssue(projectId, issueId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      setDeleteConfirmation(false)
      setShowMoreMenu(false)
      const listParams = new URLSearchParams()
      if (searchParams.get('q')) listParams.set('q', searchParams.get('q')!)
      if (searchParams.get('status')) listParams.set('status', searchParams.get('status')!)
      if (searchParams.get('priority')) listParams.set('priority', searchParams.get('priority')!)
      if (searchParams.get('owner')) listParams.set('owner', searchParams.get('owner')!)
      if (searchParams.get('assignee')) listParams.set('assignee', searchParams.get('assignee')!)
      if (searchParams.get('type')) listParams.set('type', searchParams.get('type')!)
      const queryString = listParams.toString()
      navigate(`/projects/${projectId}/issues${queryString ? `?${queryString}` : ''}`)
    },
    onError: (error: unknown) => {
      console.error('Delete issue error:', error)
      alert(errorMessage(error, 'Failed to delete issue'))
      setDeleteConfirmation(false)
    },
  })

  const handleTitleSave = () => {
    if (titleValue.trim() && titleValue !== issue?.title) {
      updateTitleMutation.mutate(titleValue.trim())
    } else {
      setIsEditingTitle(false)
    }
  }

  const handleStatusToggle = () => {
    if (issue) {
      const newStatus = issue.status === 'closed' ? 'open' : 'closed'
      updateStatusMutation.mutate(newStatus)
    }
  }

  const handleCopyLink = () => {
    const url = `${window.location.origin}/projects/${projectId}/issues/${issueId}`
    navigator.clipboard.writeText(url)
    setCopyLinkSuccess(true)
    setTimeout(() => setCopyLinkSuccess(false), 2000)
  }

  const handleBackToList = () => {
    const listParams = new URLSearchParams()
    if (searchParams.get('q')) listParams.set('q', searchParams.get('q')!)
    if (searchParams.get('status')) listParams.set('status', searchParams.get('status')!)
    if (searchParams.get('priority')) listParams.set('priority', searchParams.get('priority')!)
    if (searchParams.get('owner')) listParams.set('owner', searchParams.get('owner')!)
    if (searchParams.get('assignee')) listParams.set('assignee', searchParams.get('assignee')!)
    if (searchParams.get('type')) listParams.set('type', searchParams.get('type')!)
    const queryString = listParams.toString()
    navigate(`/projects/${projectId}/issues${queryString ? `?${queryString}` : ''}`)
  }

  if (isLoading || !issue) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  // Aligned with list page status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'closed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (issueNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-6 text-center">
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">Issue not found or deleted</h2>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
            The link may point to an issue that was removed or does not exist.
          </p>
          <Link
            to={projectId ? `/projects/${projectId}/issues` : '/'}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Issues
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">


      {/* Breadcrumb - Sticky */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto px-6 py-2">
          <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Link to="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link to={`/projects/${projectId}`} className="hover:text-blue-600 transition-colors">
              Project
            </Link>
            <span>/</span>
            <button
              onClick={handleBackToList}
              className="hover:text-blue-600 transition-colors"
            >
              Issues
            </button>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {issue.issueKey || `#${issue.id.slice(0, 8)}`}
            </span>
          </nav>
        </div>
      </div>

      {/* Header - Sticky below breadcrumb */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-[37px] z-10 shadow-sm">
        <div className="mx-auto px-6 py-4">
          <div className="flex items-start justify-between mb-3">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
              <span>Back to Issues</span>
            </button>

            <div className="flex items-center gap-2">
              {/* Subscribe button */}
              <button
                onClick={() => toggleSubscriptionMutation.mutate()}
                disabled={toggleSubscriptionMutation.isPending}
                className={clsx(
                  'p-2 rounded-lg border transition-colors',
                  isSubscribed
                    ? 'border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
                title={isSubscribed ? 'Unsubscribe' : 'Subscribe'}
              >
                {isSubscribed ? <Bell size={18} /> : <BellOff size={18} />}
              </button>

              {/* Copy link */}
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Copy link"
              >
                {copyLinkSuccess ? <Check size={18} className="text-green-600" /> : <LinkIcon size={18} />}
              </button>

              {/* More menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <MoreVertical size={18} />
                </button>

                {showMoreMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMoreMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                      <button
                        onClick={handleStatusToggle}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        {issue.status === 'closed' ? 'Reopen issue' : 'Close issue'}
                      </button>
                      <button
                        onClick={() => {
                          setShowMoreMenu(false)
                          setDeleteConfirmation(true)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        Delete issue
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="mb-2">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave()
                    if (e.key === 'Escape') setIsEditingTitle(false)
                  }}
                  className="flex-1 text-xl font-bold px-3 py-2 border border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
                <button
                  onClick={handleTitleSave}
                  disabled={updateTitleMutation.isPending}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {updateTitleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditingTitle(false)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-3 group">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex-1">
                  {issue.title}
                </h1>
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                >
                  <Edit2 size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
            <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', getStatusColor(issue.status))}>
              {issue.status}
            </span>
            {issue.issueType && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" title="Problem Report (DO-178C)">
                {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
              </span>
            )}
            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
              {issue.issueKey || `#${issue.id.slice(0, 8)}`}
            </span>
            <span>
              opened {formatDistanceToNow(new Date(issue.createdAt))} ago
              {issue.createdByUser && ` by ${issue.createdByUser.name}`}
            </span>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="mx-auto px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Description */}
            <IssueDescriptionEditor
              issue={issue}
              isEditing={isEditingDescription}
              onToggleEdit={() => setIsEditingDescription(!isEditingDescription)}
              projectId={projectId!}
            />

            {/* Linked items */}
            <IssueLinkedItems issue={issue} projectId={projectId!} />

            {/* Activity feed */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                Activity
              </h3>
              <IssueActivityFeed projectId={projectId!} issueId={issueId!} currentUserId={currentUser?.id} />
            </div>

            {/* Comment composer */}
            <IssueCommentComposer projectId={projectId!} issueId={issueId!} />
          </div>

          {/* Sidebar */}
          <div>
            <IssueSidebar issue={issue} projectId={projectId!} currentUser={currentUser} />
          </div>
        </div>
      </div>

      {deleteConfirmation && (
        <DeleteConfirmationModal
          isOpen={true}
          itemName={issue.title}
          itemType="issue"
          onConfirm={() => deleteIssueMutation.mutate()}
          onCancel={() => setDeleteConfirmation(false)}
          isDeleting={deleteIssueMutation.isPending}
        />
      )}
    </div>
  )
}
