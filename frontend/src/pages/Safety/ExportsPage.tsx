import { FileText, Download, Image, FileSpreadsheet } from 'lucide-react'

const EXPORT_OPTIONS = [
  { id: 'hazard-log', label: 'Export Hazard Log (PDF)', icon: FileText },
  { id: 'method-fha', label: 'Export Method Report — FHA', icon: FileText },
  { id: 'method-pssa', label: 'Export Method Report — PSSA', icon: FileText },
  { id: 'method-ssa', label: 'Export Method Report — SSA', icon: FileText },
  { id: 'method-fmea', label: 'Export Method Report — FMEA', icon: FileText },
  { id: 'method-cca', label: 'Export Method Report — CCA', icon: FileText },
  { id: 'method-markov', label: 'Export Method Report — Markov', icon: FileText },
  { id: 'fta-png', label: 'Export Fault Tree Diagram (PNG)', icon: Image },
  { id: 'fta-pdf', label: 'Export Fault Tree Diagram (PDF)', icon: Image },
  { id: 'trace-csv', label: 'Export Traceability Matrix (CSV)', icon: FileSpreadsheet },
]

function exportStub() {
  alert('Export will be implemented later.')
}

export default function ExportsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Exports
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Placeholder export actions. Clicking any button will show: &quot;Export will be implemented later.&quot;
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {EXPORT_OPTIONS.map((opt) => {
          const Icon = opt.icon
          return (
            <button
              key={opt.id}
              onClick={exportStub}
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                <Icon size={20} className="text-gray-600 dark:text-gray-400" />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {opt.label}
              </span>
              <Download size={16} className="ml-auto text-gray-400" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
