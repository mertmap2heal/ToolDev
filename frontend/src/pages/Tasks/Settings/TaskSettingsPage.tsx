import TaskNavigation from '../../../components/tasks/TaskNavigation'
import { Settings2 } from 'lucide-react'

export default function TaskSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Settings2 size={24} className="text-gray-900 dark:text-white" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Task Settings</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Configure task management preferences
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <p className="text-gray-600 dark:text-gray-400">Settings configuration coming soon...</p>
        </div>
      </div>
    </div>
  )
}
