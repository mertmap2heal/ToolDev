import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TaskNavigation from '../../../components/tasks/TaskNavigation'
import TaskStatsWidget from '../../../components/tasks/dashboard/TaskStatsWidget'
import RecentActivityWidget from '../../../components/tasks/dashboard/RecentActivityWidget'
import OverdueTasksWidget from '../../../components/tasks/dashboard/OverdueTasksWidget'
import MyTasksSummaryWidget from '../../../components/tasks/dashboard/MyTasksSummaryWidget'
import CreateTaskModal from '../../../components/tasks/CreateTaskModal'
import { Plus } from 'lucide-react'

export default function TasksDashboardPage() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId') || undefined
  const [showCreateModal, setShowCreateModal] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Task Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Overview of your tasks and productivity metrics
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={20} />
            Create Task
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TaskStatsWidget projectId={projectId} />
          </div>
          <div>
            <MyTasksSummaryWidget userId={undefined} />
          </div>
          <div>
            <OverdueTasksWidget projectId={projectId} />
          </div>
          <div className="lg:col-span-2">
            <RecentActivityWidget taskId={undefined} />
          </div>
        </div>
      </div>

      {showCreateModal && (
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          projectId={projectId}
        />
      )}
    </div>
  )
}
