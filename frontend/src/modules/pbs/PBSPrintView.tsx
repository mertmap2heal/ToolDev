import { useEffect, useRef } from 'react'
import { X, Printer } from 'lucide-react'
import { format } from 'date-fns'
import type { PBSNode, PBSChangeLogEntry } from './types'
import { PBS_RELATION_TYPES } from './types'
import { buildTree, type TreeNode } from './treeUtils'

interface PBSPrintViewProps {
  isOpen: boolean
  nodes: PBSNode[]
  changeLog: PBSChangeLogEntry[]
  projectName?: string
  onClose: () => void
}

export default function PBSPrintView({
  isOpen,
  nodes,
  changeLog,
  projectName,
  onClose,
}: PBSPrintViewProps) {
  const printRef = useRef<HTMLDivElement>(null)

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handlePrint = () => {
    window.print()
  }

  if (!isOpen) return null

  const tree = buildTree(nodes)
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const now = new Date()

  // Calculate statistics
  const stats = {
    total: nodes.length,
    byType: nodes.reduce((acc, n) => {
      acc[n.type] = (acc[n.type] || 0) + 1
      return acc
    }, {} as Record<string, number>),
    byStatus: nodes.reduce((acc, n) => {
      acc[n.status] = (acc[n.status] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  }

  function renderTreeNode(node: TreeNode, level: number = 0): React.ReactNode {
    const fullNode = nodeMap.get(node.id)
    if (!fullNode) return null

    const nodeChangeLog = changeLog
      .filter((e) => e.nodeId === node.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5) // Last 5 entries

    return (
      <div key={node.id} className="print-node" style={{ marginLeft: `${level * 24}px` }}>
        {/* Node Header */}
        <div className="print-node-header">
          <span className="print-code">{fullNode.pbsCode}</span>
          <span className="print-name">{fullNode.name}</span>
          <span className="print-type">{fullNode.type}</span>
          <span className={`print-status print-status-${fullNode.status.toLowerCase().replace(' ', '-')}`}>
            {fullNode.status}
          </span>
        </div>

        {/* Node Details */}
        <div className="print-node-details">
          {fullNode.description && (
            <div className="print-field">
              <span className="print-label">Description:</span>
              <span className="print-value">{fullNode.description}</span>
            </div>
          )}

          {fullNode.tags.length > 0 && (
            <div className="print-field">
              <span className="print-label">Tags:</span>
              <span className="print-value">{fullNode.tags.join(', ')}</span>
            </div>
          )}

          {fullNode.attributes.length > 0 && (
            <div className="print-field">
              <span className="print-label">Attributes:</span>
              <div className="print-attributes">
                {fullNode.attributes.map((attr, i) => (
                  <span key={i} className="print-attr">
                    {attr.key}: {attr.value}{attr.unit ? ` ${attr.unit}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {fullNode.relationships?.length > 0 && (
            <div className="print-field">
              <span className="print-label">Relationships:</span>
              <div className="print-relationships">
                {fullNode.relationships.map((rel) => {
                  const target = nodeMap.get(rel.targetId)
                  const typeLabel = PBS_RELATION_TYPES.find((rt) => rt.value === rel.type)?.label || rel.type
                  return (
                    <span key={rel.id} className="print-rel">
                      {typeLabel} → {target ? `${target.pbsCode} (${target.name})` : '(deleted)'}
                      {rel.description && ` - ${rel.description}`}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {fullNode.attachments?.length > 0 && (
            <div className="print-field">
              <span className="print-label">Attachments:</span>
              <span className="print-value">
                {fullNode.attachments.map((a) => a.name).join(', ')}
              </span>
            </div>
          )}

          <div className="print-meta">
            <span>Rev {fullNode.revision}</span>
            <span>Created: {format(new Date(fullNode.createdAt), 'PP')}</span>
            <span>Updated: {format(new Date(fullNode.updatedAt), 'PP')}</span>
          </div>

          {nodeChangeLog.length > 0 && (
            <div className="print-changelog">
              <span className="print-label">Recent changes:</span>
              {nodeChangeLog.map((entry) => (
                <div key={entry.id} className="print-log-entry">
                  <span className="print-log-date">{format(new Date(entry.timestamp), 'PP p')}</span>
                  <span className="print-log-action">{entry.action}</span>
                  {entry.details && <span className="print-log-details">{entry.details}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Children */}
        {node.children.length > 0 && (
          <div className="print-children">
            {node.children.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">
      {/* Toolbar - hidden when printing */}
      <div className="print-hide flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Print Preview
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {nodes.length} components
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Printer size={16} />
            Print
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Print Content */}
      <div className="flex-1 overflow-auto p-8 bg-white" ref={printRef}>
        <div className="print-container max-w-4xl mx-auto">
          {/* Report Header */}
          <div className="print-header">
            <h1 className="print-title">Product Breakdown Structure Report</h1>
            {projectName && <p className="print-project">Project: {projectName}</p>}
            <p className="print-date">Generated: {format(now, 'PPpp')}</p>
          </div>

          {/* Summary Section */}
          <div className="print-summary">
            <h2 className="print-section-title">Summary</h2>
            <div className="print-stats">
              <div className="print-stat">
                <span className="print-stat-value">{stats.total}</span>
                <span className="print-stat-label">Total Components</span>
              </div>
              <div className="print-stat-group">
                <span className="print-stat-group-title">By Type:</span>
                {Object.entries(stats.byType).map(([type, count]) => (
                  <span key={type} className="print-stat-item">{type}: {count}</span>
                ))}
              </div>
              <div className="print-stat-group">
                <span className="print-stat-group-title">By Status:</span>
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <span key={status} className="print-stat-item">{status}: {count}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Structure Section */}
          <div className="print-structure">
            <h2 className="print-section-title">Component Structure</h2>
            {tree.length === 0 ? (
              <p className="print-empty">No components defined.</p>
            ) : (
              tree.map((node) => renderTreeNode(node, 0))
            )}
          </div>

          {/* Footer */}
          <div className="print-footer">
            <p>End of Report — {nodes.length} components</p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .print-hide {
            display: none !important;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .print-container {
            max-width: 100% !important;
            padding: 0 !important;
          }
        }

        .print-container {
          font-family: system-ui, -apple-system, sans-serif;
          color: #1a1a1a;
          line-height: 1.5;
        }

        .print-header {
          text-align: center;
          margin-bottom: 32px;
          padding-bottom: 24px;
          border-bottom: 2px solid #e5e7eb;
        }

        .print-title {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .print-project {
          font-size: 16px;
          color: #4b5563;
          margin-bottom: 4px;
        }

        .print-date {
          font-size: 12px;
          color: #6b7280;
        }

        .print-section-title {
          font-size: 18px;
          font-weight: 600;
          margin: 24px 0 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }

        .print-summary {
          margin-bottom: 32px;
        }

        .print-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
        }

        .print-stat {
          text-align: center;
        }

        .print-stat-value {
          display: block;
          font-size: 32px;
          font-weight: 700;
          color: #2563eb;
        }

        .print-stat-label {
          font-size: 12px;
          color: #6b7280;
          text-transform: uppercase;
        }

        .print-stat-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .print-stat-group-title {
          font-weight: 600;
          font-size: 14px;
        }

        .print-stat-item {
          font-size: 13px;
          padding: 2px 8px;
          background: #f3f4f6;
          border-radius: 4px;
        }

        .print-node {
          margin-bottom: 16px;
          page-break-inside: avoid;
        }

        .print-node-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px 6px 0 0;
        }

        .print-code {
          font-family: monospace;
          font-size: 12px;
          color: #6b7280;
          background: #e5e7eb;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .print-name {
          font-weight: 600;
          flex: 1;
        }

        .print-type {
          font-size: 12px;
          padding: 2px 8px;
          background: #dbeafe;
          color: #1e40af;
          border-radius: 4px;
        }

        .print-status {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 500;
        }

        .print-status-draft { background: #f3f4f6; color: #4b5563; }
        .print-status-in-work { background: #fef3c7; color: #92400e; }
        .print-status-released { background: #d1fae5; color: #065f46; }
        .print-status-obsolete { background: #fee2e2; color: #991b1b; }

        .print-node-details {
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-top: none;
          border-radius: 0 0 6px 6px;
          font-size: 13px;
        }

        .print-field {
          margin-bottom: 8px;
        }

        .print-label {
          font-weight: 600;
          margin-right: 8px;
          color: #4b5563;
        }

        .print-value {
          color: #1f2937;
        }

        .print-attributes,
        .print-relationships {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 4px;
        }

        .print-attr,
        .print-rel {
          font-size: 12px;
          padding: 2px 8px;
          background: #f3f4f6;
          border-radius: 4px;
        }

        .print-meta {
          display: flex;
          gap: 16px;
          font-size: 11px;
          color: #9ca3af;
          margin-top: 12px;
          padding-top: 8px;
          border-top: 1px dashed #e5e7eb;
        }

        .print-changelog {
          margin-top: 12px;
          padding-top: 8px;
          border-top: 1px dashed #e5e7eb;
        }

        .print-log-entry {
          display: flex;
          gap: 12px;
          font-size: 11px;
          margin-top: 4px;
          color: #6b7280;
        }

        .print-log-date {
          color: #9ca3af;
        }

        .print-log-action {
          font-weight: 500;
          text-transform: capitalize;
        }

        .print-children {
          margin-top: 8px;
        }

        .print-empty {
          color: #6b7280;
          font-style: italic;
        }

        .print-footer {
          margin-top: 48px;
          padding-top: 16px;
          border-top: 2px solid #e5e7eb;
          text-align: center;
          font-size: 12px;
          color: #6b7280;
        }
      `}</style>
    </div>
  )
}
