import { useState } from 'react'
import { useParams, useLocation, useSearchParams } from 'react-router-dom'
import { List, LayoutGrid, Calendar } from 'lucide-react'
import ProjectNavigation from '../../components/projects/ProjectNavigation'
import TaskNavigation from '../../components/tasks/TaskNavigation'
import TaskListView from '../../components/tasks/TaskListView'
import TaskBoardView from '../../components/tasks/TaskBoardView'
import TaskCalendarView from '../../components/tasks/TaskCalendarView'
import TaskDetailDrawer from '../../components/tasks/TaskDetailDrawer'
import CSVImportExport from '../../components/tasks/CSVImportExport'
import type { Task } from '../../../shared/types/task.types'

type ViewType = 'list' | 'board' | 'calendar'

export default function TasksPage() {
  const { projectId } = useParams<{ projectId?: string }>()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const urlProjectId = searchParams.get('projectId') || projectId
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  
  // Determine view type from URL path
  let viewType: ViewType = 'list'
  if (location.pathname.includes('/board')) {
    viewType = 'board'
  } else if (location.pathname.includes('/calendar')) {
    viewType = 'calendar'
  }
  
  const setViewType = (newViewType: ViewType) => {
    // View type is controlled by URL, so we don't need local state
  }
  
  // Check if we're in the new task structure (not project-based)
  const isTaskModule = location.pathname.startsWith('/tasks')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {isTaskModule ? <TaskNavigation /> : <ProjectNavigation />}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h2>
          <div className="flex items-center gap-3">
            <CSVImportExport projectId={urlProjectId} />
            {!isTaskModule && (
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewType('list')}
                  className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm font-medium transition-colors ${
                    viewType === 'list'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                  }`}
                >
                  <List size={16} />
                  List
                </button>
                <button
                  onClick={() => setViewType('board')}
                  className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm font-medium transition-colors ${
                    viewType === 'board'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                  }`}
                >
                  <LayoutGrid size={16} />
                  Board
                </button>
                <button
                  onClick={() => setViewType('calendar')}
                  className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm font-medium transition-colors ${
                    viewType === 'calendar'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                  }`}
                >
                  <Calendar size={16} />
                  Calendar
                </button>
              </div>
            )}
          </div>
        </div>

        {viewType === 'list' ? (
          <TaskListView onTaskSelect={setSelectedTask} projectId={urlProjectId} />
        ) : viewType === 'board' ? (
          <TaskBoardView onTaskSelect={setSelectedTask} projectId={urlProjectId} />
        ) : (
          <TaskCalendarView onTaskSelect={setSelectedTask} />
        )}

        {selectedTask && (
          <TaskDetailDrawer
            task={selectedTask}
            isOpen={!!selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(updatedTask) => setSelectedTask(updatedTask)}
          />
        )}
      </div>
    </div>
  )
}
