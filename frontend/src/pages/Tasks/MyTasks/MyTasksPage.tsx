import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TaskNavigation from '../../../components/tasks/TaskNavigation'
import TaskListView from '../../../components/tasks/TaskListView'
import { UserCheck } from 'lucide-react'

export default function MyTasksPage() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId') || undefined

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <UserCheck size={24} className="text-gray-900 dark:text-white" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Tasks</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Tasks assigned to you{projectId && ' (filtered by project)'}
            </p>
          </div>
        </div>
        <TaskListView onTaskSelect={() => {}} projectId={projectId} />
      </div>
    </div>
  )
}
