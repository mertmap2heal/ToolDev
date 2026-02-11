import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Upload, History, Eye, X, RefreshCw } from 'lucide-react'
import TemplateEditor from '../../components/verification/TemplateEditor'
import VerificationTemplateBuilder from './VerificationTemplateBuilder'
import { isSectionBasedContentJson } from './verificationTemplateUtils'
import { verificationService } from '../../services/verification.service'

export default function TemplateEditorPage() {
  const { projectId, templateId } = useParams<{ projectId: string; templateId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [localJson, setLocalJson] = useState<object | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  interface VerificationTemplate {
    id?: string
    name?: string
    type?: string
    status?: string
    contentJson?: object
    versions?: unknown[]
  }
  const { data: template, isLoading } = useQuery<VerificationTemplate | null>({
    queryKey: ['verification-template', projectId, templateId],
    queryFn: async () => {
      if (!projectId || !templateId) return null
      const res = await verificationService.getTemplate(projectId, templateId)
      return res.success ? (res.data as unknown as VerificationTemplate) : null
    },
    enabled: !!projectId && !!templateId,
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: { name?: string; contentJson?: object }) => {
      if (!projectId || !templateId) throw new Error('Missing project or template')
      await verificationService.updateTemplate(projectId, templateId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-template', projectId, templateId] })
      queryClient.invalidateQueries({ queryKey: ['verification-templates', projectId] })
    },
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !templateId) throw new Error('Missing project or template')
      await verificationService.updateTemplate(projectId, templateId, { contentJson: localJson ?? undefined })
      const res = await verificationService.publishTemplate(projectId, templateId)
      if (!res.success) throw new Error(res.error || 'Publish failed')
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-template', projectId, templateId] })
      queryClient.invalidateQueries({ queryKey: ['verification-templates', projectId] })
    },
  })

  const contentJson = localJson ?? (template?.contentJson as object) ?? null
  const handleChange = useCallback((json: object) => setLocalJson(json), [])

  const docContent = contentJson && (contentJson as { type?: string; content?: unknown[] }).type === 'doc'
    ? (contentJson as { content?: unknown[] }).content
    : undefined
  const isEmptyDoc =
    contentJson &&
    (contentJson as { type?: string }).type === 'doc' &&
    (!docContent ||
      docContent.length === 0 ||
      (docContent.length === 1 &&
        (docContent[0] as { type?: string }).type === 'paragraph' &&
        !(docContent[0] as { content?: unknown[] }).content?.length))
  const useBuilder =
    !contentJson ||
    !!isEmptyDoc ||
    isSectionBasedContentJson(contentJson)

  const handleBackToLibrary = () => {
    if (projectId) navigate(`/projects/${projectId}/verification/templates`)
  }

  const handleBuilderSave = useCallback(
    (payload: { name: string; contentJson: object }) => {
      updateMutation.mutate({ name: payload.name, contentJson: payload.contentJson })
      setLocalJson(payload.contentJson)
    },
    [updateMutation]
  )

  if (!projectId || !templateId) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Missing project or template.
      </div>
    )
  }

  if (isLoading || !template) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-gray-400" size={24} />
      </div>
    )
  }

  const isDraft = (template.status || 'DRAFT') === 'DRAFT'
  const versions = (template as any).versions ?? []

  if (useBuilder) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
        <VerificationTemplateBuilder
          name={template.name ?? ''}
          type={(template.type as 'TEST_CASE' | 'TEST_PLAN') ?? 'TEST_CASE'}
          contentJson={contentJson}
          onSave={handleBuilderSave}
          onBack={handleBackToLibrary}
          onPublish={() => publishMutation.mutate()}
          onVersions={() => setShowVersions(true)}
          isDraft={isDraft}
        />

        {showVersions && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Versions</h3>
                <button
                  onClick={() => setShowVersions(false)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-y-auto p-4 space-y-2">
                {versions.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No versions yet. Publish to create one.</p>
                ) : (
                  versions.map((v: any) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Version {v.version}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {v.createdAt ? new Date(v.createdAt).toLocaleString() : '—'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
          {template.name}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleBackToLibrary}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg"
          >
            Back to library
          </button>
          <button
            onClick={() => updateMutation.mutate({ contentJson: localJson ?? undefined })}
            disabled={updateMutation.isPending || !isDraft}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50"
          >
            <Save size={16} />
            Save
          </button>
          <button
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending || !isDraft}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            <Upload size={16} />
            Publish
          </button>
          <button
            onClick={() => setShowVersions(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
          >
            <History size={16} />
            Versions
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
          >
            <Eye size={16} />
            Preview
          </button>
        </div>
      </div>

      <TemplateEditor
        contentJson={contentJson}
        onChange={handleChange}
        editable={isDraft}
      />

      {showVersions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Versions</h3>
              <button
                onClick={() => setShowVersions(false)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {versions.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No versions yet. Publish to create one.</p>
              ) : (
                versions.map((v: any) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Version {v.version}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {v.createdAt ? new Date(v.createdAt).toLocaleString() : '—'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <TemplateEditor
                contentJson={contentJson}
                onChange={() => {}}
                editable={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
