import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import clsx from 'clsx'
import type { Requirement } from '../../../../shared/types/engineering.types'

interface DraggableRequirementRowProps {
  requirement: Requirement
  level: number
  isOver?: boolean
  children: React.ReactNode
}

/**
 * DraggableRequirementRow wraps a table row with drag-and-drop functionality
 * using dnd-kit. Allows requirements to be reordered and reparented through
 * drag operations within the hierarchy.
 */
export default function DraggableRequirementRow({
  requirement,
  level,
  isOver,
  children,
}: DraggableRequirementRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: requirement.id,
    data: {
      type: 'requirement',
      requirement,
      level,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group',
        isDragging && 'opacity-50 bg-blue-50 dark:bg-blue-900/20',
        isOver && 'bg-green-50 dark:bg-green-900/20 border-t-2 border-green-500'
      )}
      {...attributes}
    >
      {/* Drag Handle Cell */}
      <td className="px-2 py-3 w-8">
        <button
          {...listeners}
          className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder or change parent"
        >
          <GripVertical size={16} />
        </button>
      </td>
      {children}
    </tr>
  )
}
