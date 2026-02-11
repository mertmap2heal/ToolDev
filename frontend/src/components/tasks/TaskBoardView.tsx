import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { DndContext, DragOverlay, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskService } from '../../services/task.service'
import CreateTaskModal from './CreateTaskModal'
import type { Task, TaskStatus, TaskPriority, BoardColumn } from 'shared/types/task.types'
import { format } from 'date-fns'

interface TaskBoardViewProps {
  onTaskSelect?: (task: Task) => void
  projectId?: string
}

interface TaskCardProps {
  task: Task
  onSelect: (task: Task) => void
}

function TaskCard({ task, onSelect }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-500'
      case 'HIGH':
        return 'bg-orange-500'
      case 'MEDIUM':
        return 'bg-yellow-500'
      case 'LOW':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(task)}
      className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 mb-2 cursor-move hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-medium text-gray-900 dark:text-white text-sm flex-1">{task.title}</h4>
        {task.blocked && (
          <AlertCircle className="text-red-500 flex-shrink-0" size={16} aria-label="Blocked" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
        {task.dueDate && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {format(new Date(task.dueDate), 'MMM dd')}
          </span>
        )}
      </div>
    </div>
  )
}

export default function TaskBoardView({ onTaskSelect, projectId: propProjectId }: TaskBoardViewProps) {
  const { projectId: paramProjectId } = useParams<{ projectId?: string }>()
  const projectId = propProjectId || paramProjectId
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createModalStatus, setCreateModalStatus] = useState<TaskStatus>('BACKLOG')
  const queryClient = useQueryClient()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const { data: columnsData, isLoading: columnsLoading } = useQuery({
    queryKey: ['board-columns', projectId],
    queryFn: async () => {
      const response = await taskService.getBoardColumns(projectId)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to load board columns')
    },
  })

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: async () => {
      const response = await taskService.getTasks({
        projectId: projectId || undefined,
        page: 1,
        pageSize: 1000, // Get all tasks for board view
      })
      if (response.success && response.data) {
        return response.data.items
      }
      throw new Error(response.error || 'Failed to load tasks')
    },
  })

  const columns = columnsData || []
  const tasks = tasksData || []

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, targetStatus, targetSortOrder }: { taskId: string; targetStatus: string; targetSortOrder?: number }) =>
      taskService.moveTaskOnBoard(taskId, targetStatus, targetSortOrder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['board-columns'] })
    },
    onError: (error: any) => {
      console.error('Move task error:', error)
      alert(error?.error || 'Failed to move task')
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const taskId = active.id as string
    const targetColumnId = over.id as string

    // Find target column
    const targetColumn = columns.find((col: BoardColumn) => col.id === targetColumnId)
    if (!targetColumn) return

    // Find task
    const task = tasks.find((t: Task) => t.id === taskId)
    if (!task) return

    // Check if moving to different column
    if (task.status === targetColumn.statusValue) return

    // Check WIP limit
    const column = columns.find((col: BoardColumn) => col.statusValue === targetColumn.statusValue)
    if (column?.wipLimit && column.taskCount && column.taskCount >= column.wipLimit) {
      alert(`WIP limit of ${column.wipLimit} reached for ${column.name}`)
      return
    }

    // Move task
    moveTaskMutation.mutate({
      taskId,
      targetStatus: targetColumn.statusValue,
    })
  }

  const getTasksForColumn = (status: string): Task[] => {
    return tasks.filter((task: Task) => task.status === status)
  }

  const activeTask = activeId ? tasks.find((t: Task) => t.id === activeId) : null

  if (columnsLoading || tasksLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500 dark:text-gray-400">Loading board...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => {
            setCreateModalStatus('BACKLOG')
            setIsCreateModalOpen(true)
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
        >
          <Plus size={18} />
          Create Task
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: {
            onDragStart({ active }) {
              return `Picked up task ${active.id}`
            },
            onDragOver({ active, over }) {
              return `Moving task ${active.id} over ${over?.id || 'empty space'}`
            },
            onDragEnd({ active, over }) {
              return over ? `Task ${active.id} moved to ${over.id}` : `Task ${active.id} returned to original position`
            },
            onDragCancel({ active }) {
              return `Task ${active.id} returned to original position`
            },
          },
        }}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column: BoardColumn) => {
            const columnTasks = getTasksForColumn(column.statusValue)
            const isWipExceeded = column.wipLimit && column.taskCount && column.taskCount >= column.wipLimit

            return (
              <div
                key={column.id}
                className="flex-shrink-0 w-80 bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{column.name}</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({column.taskCount || 0})
                    </span>
                  </div>
                  {column.wipLimit && (
                    <div
                      className={`text-xs px-2 py-1 rounded ${
                        isWipExceeded
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      WIP: {column.taskCount || 0}/{column.wipLimit}
                    </div>
                  )}
                </div>

                {isWipExceeded && (
                  <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-400">
                    WIP limit exceeded
                  </div>
                )}

                <SortableContext
                  items={columnTasks.map((t: Task) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 min-h-[200px]">
                    {columnTasks.map((task: Task) => (
                      <TaskCard key={task.id} task={task} onSelect={onTaskSelect || (() => {})} />
                    ))}
                  </div>
                </SortableContext>

                <button
                  onClick={() => {
                    setCreateModalStatus(column.statusValue as TaskStatus)
                    setIsCreateModalOpen(true)
                  }}
                  className="mt-2 w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                >
                  <Plus size={16} className="inline mr-1" />
                  Add task
                </button>
              </div>
            )
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg w-64">
              <h4 className="font-medium text-gray-900 dark:text-white text-sm">{activeTask.title}</h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        projectId={projectId}
        initialStatus={createModalStatus}
      />
    </div>
  )
}
