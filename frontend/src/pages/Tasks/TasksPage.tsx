import { useState } from 'react'
import { useParams, useLocation, useSearchParams, Link } from 'react-router-dom'

import TaskNavigation from '../../components/tasks/TaskNavigation'
import TaskListView from '../../components/tasks/TaskListView'
import TaskBoardView from '../../components/tasks/TaskBoardView'
import TaskCalendarView from '../../components/tasks/TaskCalendarView'
import TaskDetailDrawer from '../../components/tasks/TaskDetailDrawer'
import CSVImportExport from '../../components/tasks/CSVImportExport'
import type { Task } from 'shared/types/task.types'

type ViewType = 'list' | 'board' | 'calendar'

export default function TasksPage() {
  const { projectId: routeProjectId } = useParams<{ projectId?: string }>()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // Extract projectId from either route param or query param
  const projectId = routeProjectId || searchParams.get('projectId') || undefined
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // Determine view type from URL path
  let viewType: ViewType = 'list'
  if (location.pathname.includes('/board')) {
    viewType = 'board'
  } else if (location.pathname.includes('/calendar')) {
    viewType = 'calendar'
  }

  const taskContent = (
    <>
      {viewType === 'list' ? (
        <TaskListView onTaskSelect={setSelectedTask} projectId={projectId} />
      ) : viewType === 'board' ? (
        <TaskBoardView onTaskSelect={setSelectedTask} projectId={projectId} />
      ) : (
        <TaskCalendarView onTaskSelect={setSelectedTask} projectId={projectId} />
      )}

      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updatedTask) => setSelectedTask(updatedTask)}
        />
      )}
    </>
  )

  if (routeProjectId) {
    return (
      <div className="flex flex-col min-h-0">
        <div className="flex-shrink-0 space-y-4">


          <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Link to="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link
              to={`/projects/${routeProjectId}`}
              className="hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Project
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white font-medium">Tasks</span>
          </nav>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Tasks assigned and tracked within this project
              </p>
            </div>
            <div className="flex items-center gap-3">
              <CSVImportExport projectId={projectId} />
            </div>
          </div>
        </div>

        <div className="space-y-6 mt-6">
          <TaskNavigation />
          <div>{taskContent}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h2>
            {projectId && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Filtered by project
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <CSVImportExport projectId={projectId} />
          </div>
        </div>
        {taskContent}
      </div>
    </div>
  )
}
