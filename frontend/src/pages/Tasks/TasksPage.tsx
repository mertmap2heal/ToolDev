import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { List, LayoutGrid, Calendar } from 'lucide-react'
import ProjectNavigation from '../../components/projects/ProjectNavigation'
import TaskListView from '../../components/tasks/TaskListView'
import TaskBoardView from '../../components/tasks/TaskBoardView'
import TaskCalendarView from '../../components/tasks/TaskCalendarView'
import TaskDetailDrawer from '../../components/tasks/TaskDetailDrawer'
import CSVImportExport from '../../components/tasks/CSVImportExport'
import type { Task } from '../../../shared/types/task.types'

type ViewType = 'list' | 'board' | 'calendar'

export default function TasksPage() {
  const { projectId } = useParams<{ projectId?: string }>()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [viewType, setViewType] = useState<ViewType>('list')

  return (
    <div className="space-y-6">
      <ProjectNavigation />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h2>
        <div className="flex items-center gap-3">
          <CSVImportExport projectId={projectId} />
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
        </div>
      </div>

      {viewType === 'list' ? (
        <TaskListView onTaskSelect={setSelectedTask} />
      ) : viewType === 'board' ? (
        <TaskBoardView onTaskSelect={setSelectedTask} />
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
  )
}
