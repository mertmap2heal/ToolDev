import { useState, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Upload, Download, Trash2, AlertTriangle, FileText, Settings } from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import type { PBSNode, PBSType, PBSStatus, PBSChangeLogEntry, PBSRelationType, PBSRelationship, PBSAttachment } from './types'
import {
  PBS_TYPES,
  PBS_STATUSES,
  PREDEFINED_ATTRIBUTE_KEYS,
  PBS_RELATION_TYPES,
  ATTACHMENT_MAX_FILE_SIZE,
  ATTACHMENT_MAX_TOTAL_SIZE,
} from './types'
import { generateId, nowISO } from './utils'
import { getNodePath } from './treeUtils'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { PBS_EDITOR_TABS, type PBSEditorTabId } from '../../config/pbsTabs'
import type { Requirement } from 'shared/types/engineering.types'

type TabId = PBSEditorTabId

const TABS = PBS_EDITOR_TABS

interface PBSNodeEditorProps {
  node: PBSNode
  allNodes: PBSNode[]
  changeLog: PBSChangeLogEntry[]
  onUpdate: (updates: Partial<PBSNode>) => void
  pbsCodeEditable?: boolean
  projectId?: string
}

export default function PBSNodeEditor({
  node,
  allNodes,
  changeLog,
  onUpdate,
  pbsCodeEditable = false,
  projectId,
}: PBSNodeEditorProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const hierarchyPath = getNodePath(allNodes, node.id).map((n) => n.name).join(' / ')
  const nodeChangeLog = changeLog.filter((e) => e.nodeId === node.id)

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-700 flex gap-1 p-2 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === id
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            node={node}
            hierarchyPath={hierarchyPath}
            pbsCodeEditable={pbsCodeEditable}
            onUpdate={onUpdate}
          />
        )}
        {activeTab === 'attributes' && (
          <AttributesTab node={node} onUpdate={onUpdate} />
        )}
        {activeTab === 'relationships' && (
          <RelationshipsTab node={node} allNodes={allNodes} onUpdate={onUpdate} />
        )}
        {activeTab === 'attachments' && (
          <AttachmentsTab node={node} onUpdate={onUpdate} />
        )}
        {activeTab === 'requirements' && projectId && (
          <RequirementsTab projectId={projectId} componentId={node.id} componentName={node.name} />
        )}
        {activeTab === 'functions' && projectId && (
          <FunctionsTab projectId={projectId} componentId={node.id} componentName={node.name} />
        )}
        {activeTab === 'changelog' && <ChangeLogTab entries={nodeChangeLog} />}
      </div>
    </div>
  )
}

function OverviewTab({
  node,
  hierarchyPath,
  pbsCodeEditable,
  onUpdate,
}: {
  node: PBSNode
  hierarchyPath: string
  pbsCodeEditable: boolean
  onUpdate: (u: Partial<PBSNode>) => void
}) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Name (required)
        </label>
        <input
          type="text"
          value={node.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          PBS ID
        </label>
        <input
          type="text"
          value={node.pbsCode}
          onChange={(e) => (pbsCodeEditable ? onUpdate({ pbsCode: e.target.value }) : null)}
          readOnly={!pbsCodeEditable}
          className={clsx(
            'w-full px-3 py-2 border rounded-lg',
            pbsCodeEditable
              ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
              : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          )}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Type
        </label>
        <select
          value={node.type}
          onChange={(e) => onUpdate({ type: e.target.value as PBSType })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {PBS_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Lifecycle status
        </label>
        <select
          value={node.status}
          onChange={(e) => onUpdate({ status: e.target.value as PBSStatus })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          {PBS_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Description
        </label>
        <textarea
          value={node.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Tags (comma-separated)
        </label>
        <input
          type="text"
          value={node.tags.join(', ')}
          onChange={(e) =>
            onUpdate({
              tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            })
          }
          placeholder="tag1, tag2"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Created
        </span>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
          {format(new Date(node.createdAt), 'PPpp')}
        </p>
      </div>
      <div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Updated
        </span>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
          {format(new Date(node.updatedAt), 'PPpp')}
        </p>
      </div>
      <div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Revision
        </span>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">{node.revision}</p>
      </div>
      <div>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Hierarchy path
        </span>
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 truncate" title={hierarchyPath}>
          {hierarchyPath}
        </p>
      </div>
    </div>
  )
}

function AttributesTab({
  node,
  onUpdate,
}: {
  node: PBSNode
  onUpdate: (u: Partial<PBSNode>) => void
}) {
  const updateAttr = useCallback(
    (index: number, key: string, value: string, unit?: string) => {
      const attrs = [...node.attributes]
      if (index >= attrs.length) attrs.push({ key, value, unit })
      else attrs[index] = { ...attrs[index], key, value, unit }
      onUpdate({ attributes: attrs })
    },
    [node.attributes, onUpdate]
  )
  const removeAttr = useCallback(
    (index: number) => {
      const attrs = node.attributes.filter((_, i) => i !== index)
      onUpdate({ attributes: attrs })
    },
    [node.attributes, onUpdate]
  )
  const addCustom = useCallback(() => {
    onUpdate({ attributes: [...node.attributes, { key: '', value: '' }] })
  }, [node.attributes, onUpdate])

  const predefinedRows = PREDEFINED_ATTRIBUTE_KEYS.map((key) => {
    const existing = node.attributes.find((a) => a.key === key)
    return { key, value: existing?.value ?? '', unit: existing?.unit }
  })
  const customRows = node.attributes.filter((a) => !PREDEFINED_ATTRIBUTE_KEYS.includes(a.key))

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Predefined attributes
        </h4>
        <div className="space-y-2">
          {predefinedRows.map((row) => (
            <div key={row.key} className="grid grid-cols-12 gap-2 items-center">
              <span className="col-span-3 text-sm text-gray-700 dark:text-gray-300">{row.key}</span>
              <input
                type="text"
                value={row.value}
                onChange={(e) => {
                  const rest = node.attributes.filter((a) => a.key !== row.key)
                  onUpdate({ attributes: [...rest, { key: row.key, value: e.target.value, unit: row.unit }] })
                }}
                className="col-span-4 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
              <select
                value={row.unit ?? ''}
                onChange={(e) => {
                  const unit = e.target.value || undefined
                  const rest = node.attributes.filter((a) => a.key !== row.key)
                  onUpdate({ attributes: [...rest, { key: row.key, value: row.value, unit }] })
                }}
                className="col-span-3 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">—</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="mm">mm</option>
                <option value="m">m</option>
              </select>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Custom attributes</h4>
          <button
            type="button"
            onClick={addCustom}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Add row
          </button>
        </div>
        <div className="space-y-2">
          {customRows.map((row) => {
            const globalIndex = node.attributes.findIndex((a) => a === row)
            return (
              <div key={globalIndex} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) => updateAttr(globalIndex, e.target.value, row.value, row.unit)}
                  placeholder="Key"
                  className="col-span-3 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => updateAttr(globalIndex, row.key, e.target.value, row.unit)}
                  placeholder="Value"
                  className="col-span-4 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeAttr(globalIndex)}
                  className="col-span-2 text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function RelationshipsTab({
  node,
  allNodes,
  onUpdate,
}: {
  node: PBSNode
  allNodes: PBSNode[]
  onUpdate: (u: Partial<PBSNode>) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [newTargetId, setNewTargetId] = useState('')
  const [newType, setNewType] = useState<PBSRelationType>('related_to')
  const [newDescription, setNewDescription] = useState('')

  // Get nodes that can be linked (exclude self and already linked nodes)
  const linkedIds = new Set(node.relationships.map((r) => r.targetId))
  const availableTargets = allNodes.filter(
    (n) => n.id !== node.id && !linkedIds.has(n.id)
  )

  const addRelationship = useCallback(() => {
    if (!newTargetId) return
    const newRel: PBSRelationship = {
      id: generateId(),
      targetId: newTargetId,
      type: newType,
      description: newDescription.trim() || undefined,
    }
    onUpdate({ relationships: [...node.relationships, newRel] })
    setIsAdding(false)
    setNewTargetId('')
    setNewType('related_to')
    setNewDescription('')
  }, [newTargetId, newType, newDescription, node.relationships, onUpdate])

  const removeRelationship = useCallback(
    (relId: string) => {
      onUpdate({ relationships: node.relationships.filter((r) => r.id !== relId) })
    },
    [node.relationships, onUpdate]
  )

  const updateRelationship = useCallback(
    (relId: string, updates: Partial<PBSRelationship>) => {
      onUpdate({
        relationships: node.relationships.map((r) =>
          r.id === relId ? { ...r, ...updates } : r
        ),
      })
    },
    [node.relationships, onUpdate]
  )

  // Find incoming relationships (other nodes that reference this node)
  const incomingRelationships = allNodes
    .filter((n) => n.id !== node.id)
    .flatMap((n) =>
      n.relationships
        .filter((r) => r.targetId === node.id)
        .map((r) => ({ ...r, sourceNode: n }))
    )

  // INCOSE traceability: structural links derived from hierarchy (parent, siblings)
  const parentNode = node.parentId ? allNodes.find((n) => n.id === node.parentId) : null
  const siblings = allNodes.filter(
    (n) => n.parentId === node.parentId && n.id !== node.id
  )

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Structural links (INCOSE traceability: parent and siblings) */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Structural links (INCOSE traceability)
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Parent and sibling relationships derived from the PBS hierarchy for traceability.
        </p>
        <div className="space-y-2">
          {parentNode ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">
                Part of (parent)
              </span>
              <span className="text-gray-400 dark:text-gray-500">→</span>
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {parentNode.pbsCode} — {parentNode.name}
              </span>
            </div>
          ) : (
            <div className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-500 dark:text-gray-400">
              Root component (no parent)
            </div>
          )}
          {siblings.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">
                Siblings ({siblings.length})
              </span>
              <div className="space-y-1">
                {siblings.map((sib) => (
                  <div
                    key={sib.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                  >
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">
                      Related (sibling)
                    </span>
                    <span className="text-gray-400 dark:text-gray-500">→</span>
                    <span className="text-sm text-blue-600 dark:text-blue-400">
                      {sib.pbsCode} — {sib.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Outgoing relationships */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Outgoing relationships
          </h4>
          {!isAdding && availableTargets.length > 0 && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Add relationship
            </button>
          )}
        </div>

        {isAdding && (
          <div className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20 mb-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Target component
                </label>
                <select
                  value={newTargetId}
                  onChange={(e) => setNewTargetId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">Select a component...</option>
                  {availableTargets.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.pbsCode} — {n.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Relationship type
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as PBSRelationType)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  {PBS_RELATION_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>
                      {rt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g., Power supply interface"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={addRelationship}
                  disabled={!newTargetId}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false)
                    setNewTargetId('')
                    setNewType('related_to')
                    setNewDescription('')
                  }}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {node.relationships.length === 0 && !isAdding ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No outgoing relationships defined.
          </p>
        ) : (
          <div className="space-y-2">
            {node.relationships.map((rel) => {
              const target = allNodes.find((n) => n.id === rel.targetId)
              const typeLabel = PBS_RELATION_TYPES.find((rt) => rt.value === rel.type)?.label || rel.type
              return (
                <div
                  key={rel.id}
                  className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {typeLabel}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500">→</span>
                      <span className="text-sm text-blue-600 dark:text-blue-400 truncate">
                        {target ? `${target.pbsCode} — ${target.name}` : '(deleted)'}
                      </span>
                    </div>
                    {rel.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {rel.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={rel.type}
                      onChange={(e) =>
                        updateRelationship(rel.id, { type: e.target.value as PBSRelationType })
                      }
                      className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      {PBS_RELATION_TYPES.map((rt) => (
                        <option key={rt.value} value={rt.value}>
                          {rt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeRelationship(rel.id)}
                      className="text-xs px-2 py-1 text-red-600 dark:text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Incoming relationships */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Incoming relationships
        </h4>
        {incomingRelationships.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No other components reference this item.
          </p>
        ) : (
          <div className="space-y-2">
            {incomingRelationships.map((rel) => {
              const typeLabel = PBS_RELATION_TYPES.find((rt) => rt.value === rel.type)?.label || rel.type
              return (
                <div
                  key={`${rel.sourceNode.id}-${rel.id}`}
                  className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-blue-600 dark:text-blue-400 truncate">
                        {rel.sourceNode.pbsCode} — {rel.sourceNode.name}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500">→</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {typeLabel}
                      </span>
                    </div>
                    {rel.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {rel.description}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Relationships are peer-to-peer connections between PBS components.
          Parent-child relationships are managed through the tree structure.
        </p>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType === 'application/pdf') return '📄'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝'
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦'
  return '📎'
}

function AttachmentsTab({
  node,
  onUpdate,
}: {
  node: PBSNode
  onUpdate: (u: Partial<PBSNode>) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const totalSize = node.attachments.reduce((sum, a) => sum + a.size, 0)
  const remainingSpace = ATTACHMENT_MAX_TOTAL_SIZE - totalSize

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setError(null)

      const newAttachments: PBSAttachment[] = []
      const errors: string[] = []

      for (const file of Array.from(files)) {
        // Check individual file size
        if (file.size > ATTACHMENT_MAX_FILE_SIZE) {
          errors.push(`"${file.name}" exceeds ${formatFileSize(ATTACHMENT_MAX_FILE_SIZE)} limit`)
          continue
        }

        // Check total size
        const newTotal = totalSize + newAttachments.reduce((s, a) => s + a.size, 0) + file.size
        if (newTotal > ATTACHMENT_MAX_TOTAL_SIZE) {
          errors.push(`"${file.name}" would exceed total storage limit`)
          continue
        }

        // Check for duplicate names
        if (node.attachments.some((a) => a.name === file.name) || newAttachments.some((a) => a.name === file.name)) {
          errors.push(`"${file.name}" already exists`)
          continue
        }

        // Read file as base64
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsDataURL(file)
          })

          newAttachments.push({
            id: generateId(),
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            dataUrl,
            addedAt: nowISO(),
          })
        } catch {
          errors.push(`Failed to read "${file.name}"`)
        }
      }

      if (newAttachments.length > 0) {
        onUpdate({ attachments: [...node.attachments, ...newAttachments] })
      }

      if (errors.length > 0) {
        setError(errors.join('. '))
      }
    },
    [node.attachments, totalSize, onUpdate]
  )

  const removeAttachment = useCallback(
    (attachmentId: string) => {
      onUpdate({ attachments: node.attachments.filter((a) => a.id !== attachmentId) })
    },
    [node.attachments, onUpdate]
  )

  const downloadAttachment = useCallback((attachment: PBSAttachment) => {
    const link = document.createElement('a')
    link.href = attachment.dataUrl
    link.download = attachment.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect]
  )

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Storage info */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {node.attachments.length} file{node.attachments.length !== 1 ? 's' : ''} · {formatFileSize(totalSize)} used
        </span>
        <span>{formatFileSize(remainingSpace)} remaining</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full transition-all',
            totalSize / ATTACHMENT_MAX_TOTAL_SIZE > 0.9
              ? 'bg-red-500'
              : totalSize / ATTACHMENT_MAX_TOTAL_SIZE > 0.7
              ? 'bg-amber-500'
              : 'bg-blue-500'
          )}
          style={{ width: `${(totalSize / ATTACHMENT_MAX_TOTAL_SIZE) * 100}%` }}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <Upload size={24} className="mx-auto mb-2 text-gray-400 dark:text-gray-500" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Drop files here or click to browse
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          Max {formatFileSize(ATTACHMENT_MAX_FILE_SIZE)} per file
        </p>
      </div>

      {/* Attachments list */}
      {node.attachments.length > 0 && (
        <div className="space-y-2">
          {node.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800"
            >
              <span className="text-xl">{getFileIcon(attachment.mimeType)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {attachment.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(attachment.size)} · {format(new Date(attachment.addedAt), 'PP')}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadAttachment(attachment)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  title="Download"
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => removeAttachment(attachment.id)}
                  className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  title="Remove"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info note */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Attachments are stored locally in your browser. Large files or many attachments may impact performance.
          Consider using external storage for large files.
        </p>
      </div>
    </div>
  )
}

function RequirementsTab({
  projectId,
  componentId,
  componentName,
}: {
  projectId: string
  componentId: string
  componentName: string
}) {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({
    queryKey: ['requirements-by-component', projectId, componentId],
    queryFn: async () => {
      const response = await requirementService.getRequirements(projectId, {
        componentId,
        pageSize: 100,
      })
      if (!response.success || !response.data) return []
      const paginated = response.data as { items?: Requirement[] }
      return paginated.items ?? []
    },
    enabled: !!projectId && !!componentId,
  })
  const requirements: Requirement[] = data ?? []

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">Loading linked requirements…</div>
    )
  }
  if (error) {
    return (
      <div className="text-sm text-amber-600 dark:text-amber-400">
        Failed to load requirements
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Requirements allocated to <span className="font-medium text-gray-900 dark:text-white">{componentName}</span>
      </p>
      {requirements.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No requirements allocated to this component. Use the Requirements panel on the right to drag and drop.
        </p>
      ) : (
        <ul className="space-y-2">
          {requirements.map((req) => (
            <li
              key={req.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/projects/${projectId}/requirements?requirementId=${req.id}`)}
            >
              <FileText size={14} className="text-blue-500 shrink-0" />
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {req.requirementId ?? req.id.slice(0, 8)}
              </span>
              <span className="text-sm text-gray-900 dark:text-white truncate" title={req.title}>
                {req.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FunctionsTab({
  projectId,
  componentId,
  componentName,
}: {
  projectId: string
  componentId: string
  componentName: string
}) {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery({
    queryKey: ['functions-by-component', projectId, componentId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      if (!response.success || !response.data) return []
      return response.data.filter((f: { pbsComponentId?: string | null }) => f.pbsComponentId === componentId)
    },
    enabled: !!projectId && !!componentId,
  })
  const functions = data ?? []

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">Loading allocated functions…</div>
    )
  }
  if (error) {
    return (
      <div className="text-sm text-amber-600 dark:text-amber-400">
        Failed to load functions
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Functions allocated to <span className="font-medium text-gray-900 dark:text-white">{componentName}</span>
      </p>
      {functions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No functions allocated to this component. Use the Functions tab in the panel on the right to drag and drop.
        </p>
      ) : (
        <ul className="space-y-2">
          {functions.map((fn: { id: string; functionId?: string; name: string }) => (
            <li
              key={fn.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
              onClick={() => navigate(`/projects/${projectId}/functions?functionId=${fn.id}`)}
            >
              <Settings size={14} className="text-indigo-500 shrink-0" />
              <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {fn.functionId ?? fn.id.slice(0, 8)}
              </span>
              <span className="text-sm text-gray-900 dark:text-white truncate" title={fn.name}>
                {fn.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ChangeLogTab({ entries }: { entries: PBSChangeLogEntry[] }) {
  return (
    <div className="space-y-2 max-w-2xl">
      {entries.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No change log entries for this component.</p>
      ) : (
        entries
          .slice()
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .map((e) => (
            <div
              key={e.id}
              className="flex gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                {format(new Date(e.timestamp), 'PPpp')}
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                {e.action}
              </span>
              {e.details && (
                <span className="text-sm text-gray-600 dark:text-gray-400">{e.details}</span>
              )}
            </div>
          ))
      )}
    </div>
  )
}
