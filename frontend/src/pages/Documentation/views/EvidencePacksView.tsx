import { Package, Plus, Eye, Download, Copy, FileCheck } from 'lucide-react'
import clsx from 'clsx'
import type { EvidencePack, EvidencePackStatus } from '../types'

const STATUS_COLORS: Record<EvidencePackStatus, string> = {
  Draft: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  Prepared: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
  Exported: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
}

interface EvidencePacksViewProps {
  packs: EvidencePack[]
  onCreatePack: () => void
  onOpenPack: (packId: string) => void
  onExportPackPlaceholder: () => void
  onDuplicatePack: (pack: EvidencePack) => void
  onIncludeComplianceMatrix: () => void
}

export default function EvidencePacksView({
  packs,
  onCreatePack,
  onOpenPack,
  onExportPackPlaceholder,
  onDuplicatePack,
  onIncludeComplianceMatrix,
}: EvidencePacksViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={onIncludeComplianceMatrix}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <FileCheck size={16} className="inline mr-2" />
          Include Compliance Matrix (Generated)
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Pack ID
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Title
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Purpose
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                  Items
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
              {packs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Package size={40} className="mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                    <p className="text-gray-500 dark:text-gray-400 mb-4">No evidence packs. Create one to get started.</p>
                    <button
                      onClick={onCreatePack}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg inline-flex items-center gap-2 transition-colors"
                    >
                      <Plus size={16} />
                      Create Evidence Pack
                    </button>
                  </td>
                </tr>
              ) : (
                packs.map((pack) => (
                  <tr key={pack.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-white">{pack.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{pack.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{pack.purpose}</td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          STATUS_COLORS[pack.status]
                        )}
                      >
                        {pack.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{pack.items.length}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{pack.lastUpdated}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onOpenPack(pack.id)}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Open"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={onExportPackPlaceholder}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Export pack"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => onDuplicatePack(pack)}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Duplicate"
                        >
                          <Copy size={16} />
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
