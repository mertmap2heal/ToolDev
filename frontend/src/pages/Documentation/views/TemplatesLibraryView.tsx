import { FileCode, Copy, Download, Edit, Plus } from 'lucide-react'
import type { Template } from '../types'

interface TemplatesLibraryViewProps {
  templates: Template[]
  onUseTemplate: (template: Template) => void
  onEditTemplate: (templateId: string) => void
  onDuplicateTemplate: (template: Template) => void
  onExportTemplatePlaceholder: () => void
}

export default function TemplatesLibraryView({
  templates,
  onUseTemplate,
  onEditTemplate,
  onDuplicateTemplate,
  onExportTemplatePlaceholder,
}: TemplatesLibraryViewProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Template ID
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Document Type
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Scope
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Last Updated
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <FileCode size={40} className="mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                    <p className="text-gray-500 dark:text-gray-400">No templates. Create one from the Template Builder.</p>
                  </td>
                </tr>
              ) : (
                templates.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-white">{t.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{t.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.docType}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.scope}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{t.lastUpdated}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onUseTemplate(t)}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Use"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => onEditTemplate(t.id)}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => onDuplicateTemplate(t)}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Duplicate"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={onExportTemplatePlaceholder}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Export template (placeholder)"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
