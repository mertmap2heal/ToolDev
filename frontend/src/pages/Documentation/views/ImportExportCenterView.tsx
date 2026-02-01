import { useState } from 'react'
import { Upload, FileCode, Link2, Plus, Pencil } from 'lucide-react'
import type { ExportProfile } from '../types'

interface ImportExportCenterViewProps {
  profiles: ExportProfile[]
  onImportDocumentPlaceholder: () => void
  onImportTemplatePlaceholder: () => void
  onImportExternalPlaceholder: () => void
  onCreateProfile: () => void
  onEditProfile: (profile: ExportProfile) => void
}

export default function ImportExportCenterView({
  profiles,
  exportHistory,
  onImportDocumentPlaceholder,
  onImportTemplatePlaceholder,
  onImportExternalPlaceholder,
  onCreateProfile,
  onEditProfile,
  onExportHistoryDetail,
  onPlannedFeature,
}: ImportExportCenterViewProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Import</h3>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={onImportDocumentPlaceholder}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Upload size={18} />
            Import Document (DOCX/PDF)
          </button>
          <button
            onClick={onImportTemplatePlaceholder}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <FileCode size={18} />
            Import Template
          </button>
          <button
            onClick={onImportExternalPlaceholder}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Link2 size={18} />
            Import from external tool
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">All import actions open placeholder modals.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Export profiles</h3>
          <button
            onClick={onCreateProfile}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            <Plus size={16} />
            Create profile
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Format
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Watermark
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Include manifest
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Numbering
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                    No export profiles. Create one to use in Export modal.
                  </td>
                </tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{p.format}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{p.watermark}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{p.includeManifest ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{p.numbering ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onEditProfile(p)}
                        className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
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
