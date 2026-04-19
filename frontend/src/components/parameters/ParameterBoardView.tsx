import { useState, useMemo, useCallback, memo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { FolderOpen, CircleDashed, CheckCircle2, Archive } from 'lucide-react'
import type { Parameter, ParameterFolder } from 'shared/types/engineering.types'
import { parameterService } from '../../services/parameter.service'

type BoardStatus = 'draft' | 'approved' | 'obsolete'

const COLUMNS: { key: BoardStatus; label: string; icon: typeof CircleDashed; accent: string }[] = [
  { key: 'draft', label: 'Draft', icon: CircleDashed, accent: 'bg-amber-500' },
  { key: 'approved', label: 'Approved', icon: CheckCircle2, accent: 'bg-emerald-500' },
  { key: 'obsolete', label: 'Obsolete', icon: Archive, accent: 'bg-gray-400' },
]

const DATA_TYPE_COLOURS: Record<string, string> = {
  float: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  int: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  double: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  bool: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  string: 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
}

interface Props {
  parameters: Parameter[]
  folders: ParameterFolder[]
  projectId: string
}

export default function ParameterBoardView({ parameters, folders, projectId }: Props) {
  const queryClient = useQueryClient()
  const [activeParam, setActiveParam] = useState<Parameter | null>(null)
  const [optimisticOverride, setOptimisticOverride] = useState<Record<string, BoardStatus>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const folderPath = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]))
    return (folderId?: string | null): string => {
      if (!folderId) return ''
      const parts: string[] = []
      let cur = byId.get(folderId)
      while (cur) {
        parts.unshift(cur.name)
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      }
      return parts.join(' / ')
    }
  }, [folders])

  const buckets = useMemo(() => {
    const out: Record<BoardStatus, Parameter[]> = { draft: [], approved: [], obsolete: [] }
    for (const p of parameters) {
      const status = (optimisticOverride[p.id] ?? (p.status as BoardStatus) ?? 'draft') as BoardStatus
      if (out[status]) out[status].push(p)
      else out.draft.push(p)
    }
    return out
  }, [parameters, optimisticOverride])

  const paramsById = useMemo(() => new Map(parameters.map((p) => [p.id, p])), [parameters])

  const handleDragStart = useCallback(
    (evt: DragStartEvent) => {
      const p = paramsById.get(String(evt.active.id))
      if (p) setActiveParam(p)
    },
    [paramsById],
  )

  const handleDragEnd = useCallback(
    async (evt: DragEndEvent) => {
      setActiveParam(null)
      const paramId = String(evt.active.id)
      const overId = evt.over?.id ? String(evt.over.id) : null
      if (!overId) return
      const targetStatus = overId.startsWith('col-')
        ? (overId.replace('col-', '') as BoardStatus)
        : null
      if (!targetStatus) return
      const param = paramsById.get(paramId)
      if (!param || param.status === targetStatus) return

      setOptimisticOverride((prev) => ({ ...prev, [paramId]: targetStatus }))
      try {
        const res = await parameterService.updateParameter(projectId, paramId, { status: targetStatus })
        if (!res.success) throw new Error((res as any).error ?? 'update failed')
        await queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
        setOptimisticOverride((prev) => {
          const { [paramId]: _drop, ...rest } = prev
          return rest
        })
      } catch {
        setOptimisticOverride((prev) => {
          const { [paramId]: _drop, ...rest } = prev
          return rest
        })
      }
    },
    [paramsById, projectId, queryClient],
  )

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 h-[calc(100vh-220px)] min-h-[400px] px-4 pt-2 overflow-x-auto">
        {COLUMNS.map((col) => (
          <BoardColumn
            key={col.key}
            column={col}
            items={buckets[col.key]}
            folderPath={folderPath}
          />
        ))}
      </div>
      <DragOverlay>
        {activeParam ? <Card param={activeParam} folderPath={folderPath(activeParam.folderId)} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}

interface ColumnProps {
  column: { key: BoardStatus; label: string; icon: typeof CircleDashed; accent: string }
  items: Parameter[]
  folderPath: (folderId?: string | null) => string
}

function BoardColumn({ column, items, folderPath }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${column.key}` })
  const Icon = column.icon
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] max-w-sm flex flex-col rounded-xl border transition-colors ${
        isOver
          ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30'
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className={`w-2 h-2 rounded-full ${column.accent}`} />
        <Icon size={14} className="text-gray-500" />
        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
          {column.label}
        </h3>
        <span className="ml-auto text-[10px] text-gray-500 dark:text-gray-400 font-mono">{items.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {items.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-6">Drop parameters here</p>
        ) : (
          items.map((p) => <DraggableCard key={p.id} param={p} folderPath={folderPath(p.folderId)} />)
        )}
      </div>
    </div>
  )
}

function DraggableCard({ param, folderPath }: { param: Parameter; folderPath: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: param.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={isDragging ? 'opacity-40' : ''}
    >
      <Card param={param} folderPath={folderPath} />
    </div>
  )
}

const Card = memo(function Card({
  param,
  folderPath,
  isDragging,
}: {
  param: Parameter
  folderPath: string
  isDragging?: boolean
}) {
  const typeColor = param.dataType ? DATA_TYPE_COLOURS[param.dataType] ?? 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300' : 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
  return (
    <div
      className={`rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-2.5 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
        isDragging ? 'shadow-lg ring-2 ring-blue-400' : ''
      }`}
    >
      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate" title={param.name}>
        {param.name}
      </p>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        {param.dataType && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${typeColor}`}>
            {param.dataType}
          </span>
        )}
        {param.unit && (
          <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-700 dark:text-gray-300 font-mono">
            {param.unit}
          </span>
        )}
        {(() => {
          const authorType = (param as unknown as { authorType?: string }).authorType
          return authorType && authorType !== 'human' ? (
            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-[10px]">
              AI
            </span>
          ) : null
        })()}
      </div>
      {folderPath && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 truncate">
          <FolderOpen size={10} />
          {folderPath}
        </p>
      )}
    </div>
  )
})
