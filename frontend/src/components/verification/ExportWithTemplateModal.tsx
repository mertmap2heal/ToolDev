import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Download, Loader2 } from 'lucide-react'
import { verificationService } from '../../services/verification.service'

interface ExportWithTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  entityType: 'TEST_CASE' | 'TEST_PLAN'
  entityId: string
  entityName: string
}

export default function ExportWithTemplateModal({
  isOpen,
  onClose,
  projectId,
  entityType,
  entityId,
  entityName,
}: ExportWithTemplateModalProps) {
  const [templateId, setTemplateId] = useState<string>('')
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['verification-templates', projectId, entityType],
    queryFn: async () => {
      const res = await verificationService.getTemplates(projectId, { type: entityType })
      return res.success && res.data ? res.data : []
    },
    enabled: isOpen && !!projectId,
  })

  const handleExport = async () => {
    if (!templateId) {
      setError('Select a template')
      return
    }
    setError(null)
    setIsExporting(true)
    try {
      const blob = await verificationService.exportWithTemplate(projectId, {
        entityType,
        entityId,
        templateId,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${entityType === 'TEST_CASE' ? 'TestCase' : 'TestPlan'}-${entityName.replace(/[^a-z0-9]/gi, '_')}-export.docx`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Export using template
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Export <strong className="text-gray-900 dark:text-white">{entityName}</strong> as DOCX
            using a custom template.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Template
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a template…</option>
              {isLoading ? (
                <option disabled>Loading…</option>
              ) : (
                templates
                  .filter((t: any) => (t.status || 'DRAFT') !== 'ARCHIVED')
                  .map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.status === 'PUBLISHED' ? '(published)' : ''}
                    </option>
                  ))
              )}
            </select>
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || !templateId}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
