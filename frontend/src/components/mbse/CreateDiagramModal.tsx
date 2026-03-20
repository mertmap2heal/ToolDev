import { useState, useRef } from 'react'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  FileText,
  Box,
  Layers,
  Activity,
  GitBranch,
  Circle,
  Users,
  Package,
  Calculator,
  Link2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { diagramService } from '../../services/diagram.service'
import type { DiagramType, CreateDiagramDto, SourceElementType } from 'shared/types/diagram.types'
import clsx from 'clsx'

interface CreateDiagramModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  diagramType: DiagramType
  sourceElement?: {
    id: string
    type: SourceElementType
    name: string
  }
  onDiagramCreated?: (diagramId: string, diagramType: DiagramType, name: string) => void
}

/**
 * Diagram type configuration
 */
const DIAGRAM_TYPE_INFO: Record<DiagramType, { label: string; icon: React.ReactNode; color: string }> = {
  'req': { label: 'Requirements Diagram', icon: <FileText size={20} />, color: '#3b82f6' },
  'bdd': { label: 'Block Definition Diagram', icon: <Box size={20} />, color: '#14b8a6' },
  'ibd': { label: 'Internal Block Diagram', icon: <Layers size={20} />, color: '#a855f7' },
  'pkg': { label: 'Package Diagram', icon: <Package size={20} />, color: '#6b7280' },
  'act': { label: 'Activity Diagram', icon: <Activity size={20} />, color: '#22c55e' },
  'seq': { label: 'Sequence Diagram', icon: <GitBranch size={20} />, color: '#06b6d4' },
  'stm': { label: 'State Machine Diagram', icon: <Circle size={20} />, color: '#f59e0b' },
  'uc': { label: 'Use Case Diagram', icon: <Users size={20} />, color: '#ec4899' },
  'par': { label: 'Parametric Diagram', icon: <Calculator size={20} />, color: '#8b5cf6' },
  'par-req': { label: 'Parameter-Requirement Matrix', icon: <Link2 size={20} />, color: '#0ea5e9' },
}

/**
 * CreateDiagramModal provides a form for creating new MBSE diagrams
 * with optional linking to source elements via trace links.
 */
export default function CreateDiagramModal({
  isOpen,
  onClose,
  projectId,
  diagramType,
  sourceElement,
  onDiagramCreated,
}: CreateDiagramModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [createTraceLink, setCreateTraceLink] = useState(true)
  const [error, setError] = useState<string | null>(null)

  onDiscardRef.current = () => {
    setName('')
    setDescription('')
    setCreateTraceLink(true)
    setError(null)
  }

  const typeInfo = DIAGRAM_TYPE_INFO[diagramType]

  // Generate default name based on source element
  const generateDefaultName = () => {
    if (sourceElement) {
      return `${typeInfo.label} - ${sourceElement.name}`
    }
    return `New ${typeInfo.label}`
  }

  // Create diagram mutation
  const createDiagramMutation = useMutation({
    mutationFn: async (data: CreateDiagramDto) => {
      const response = await diagramService.createDiagram(projectId, data)
      if (!response.success) {
        throw new Error(response.error || 'Failed to create diagram')
      }
      return response.data!
    },
    onSuccess: (diagram) => {
      // Invalidate diagrams query
      queryClient.invalidateQueries({ queryKey: ['diagrams', projectId] })
      // Invalidate trace links if created
      if (createTraceLink && sourceElement) {
        queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
      }
      
      // Notify parent
      if (onDiagramCreated) {
        onDiagramCreated(diagram.id, diagram.diagramType as DiagramType, diagram.name)
      }
      
      // Reset and close
      setName('')
      setDescription('')
      setError(null)
      resetDirty()
      onClose()
    },
    onError: (err: Error) => {
      setError(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const diagramName = name.trim() || generateDefaultName()

    const data: CreateDiagramDto = {
      diagramType,
      name: diagramName,
      description: description.trim() || undefined,
      sourceElementId: sourceElement?.id,
      sourceElementType: sourceElement?.type,
      createTraceLink: createTraceLink && !!sourceElement,
    }

    createDiagramMutation.mutate(data)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div 
          className="px-6 py-4 border-b border-gray-200 dark:border-gray-700"
          style={{ backgroundColor: typeInfo.color + '10' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: typeInfo.color + '20', color: typeInfo.color }}
              >
                {typeInfo.icon}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Create Diagram
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {typeInfo.label}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {draftBanner}
              <button
                onClick={guardClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Source Element Info */}
          {sourceElement && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                Source Element
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {sourceElement.name}
                </span>
                <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded">
                  {sourceElement.type}
                </span>
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Diagram Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty() }}
              placeholder={generateDefaultName()}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Enter a description for this diagram..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
            />
          </div>

          {/* Create Trace Link Option */}
          {sourceElement && (
            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={createTraceLink}
                onChange={(e) => setCreateTraceLink(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Create trace link
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Link this diagram to the source element for traceability
                </div>
              </div>
            </label>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={guardClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createDiagramMutation.isPending}
              className={clsx(
                'px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2',
                createDiagramMutation.isPending
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              )}
            >
              {createDiagramMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              Create Diagram
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
