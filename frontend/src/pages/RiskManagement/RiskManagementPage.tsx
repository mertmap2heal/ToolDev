import { AlertTriangle } from 'lucide-react'
import ProjectNavigation from '../../components/projects/ProjectNavigation'

export default function RiskManagementPage() {
  return (
    <div className="space-y-6">
      <ProjectNavigation />
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Risk Management</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Program and product risk register — schedule, cost, technical risks, mitigation, and owners.
        </p>
      </div>
      <div className="p-6 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-center text-gray-500 dark:text-gray-400">
        <AlertTriangle size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Risk Management features will be implemented here.</p>
      </div>
    </div>
  )
}
