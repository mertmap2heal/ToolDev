import { ShieldCheck, FileCheck, AlertCircle } from 'lucide-react'
import ProjectNavigation from '../../components/projects/ProjectNavigation'

export default function ComplianceCheckPage() {
  return (
    <div className="space-y-6">
      <ProjectNavigation />
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compliance Check</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Run and track compliance checks against requirements, standards, and regulations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <ShieldCheck className="text-blue-500 mb-2" size={24} />
          <h3 className="font-medium text-gray-900 dark:text-white">Run Checks</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Execute compliance checks on requirements and artifacts.
          </p>
        </div>
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <FileCheck className="text-green-500 mb-2" size={24} />
          <h3 className="font-medium text-gray-900 dark:text-white">Standards & Rules</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Define standards, regulations, and check rules.
          </p>
        </div>
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <AlertCircle className="text-amber-500 mb-2" size={24} />
          <h3 className="font-medium text-gray-900 dark:text-white">Findings & Reports</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            View findings, gaps, and compliance reports.
          </p>
        </div>
      </div>

      <div className="p-6 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400">
        <ShieldCheck size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Compliance Check features will be implemented here.</p>
      </div>
    </div>
  )
}
