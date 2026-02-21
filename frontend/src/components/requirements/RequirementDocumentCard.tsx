import React from 'react'
import { format } from 'date-fns'
import type { Requirement } from 'shared/types/engineering.types'
import type { Link } from 'shared/types/linkage.types'
import clsx from 'clsx'

interface RequirementDocumentCardProps {
  requirement: Requirement
  links: Link[]
  projectName?: string
  onRequirementClick?: (req: Requirement) => void
}

function formatLinkType(linkType: string): string {
  return linkType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatEntityType(type: string): string {
  const map: Record<string, string> = {
    requirement: 'Requirement',
    function: 'Function',
    pbs_component: 'PBS Component',
    change_request: 'Change Request',
    issue: 'Issue',
    test_plan: 'Test Plan',
    test_case: 'Test Case',
    verification: 'Verification',
    use_case: 'Use Case',
  }
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function RequirementDocumentCard({
  requirement,
  links,
  projectName,
  onRequirementClick,
}: RequirementDocumentCardProps) {
  const createdFormatted = requirement.createdAt
    ? format(new Date(requirement.createdAt), 'MM/dd/yyyy hh:mm:ss a O')
    : '—'
  const updatedFormatted = requirement.updatedAt
    ? format(new Date(requirement.updatedAt), 'MM/dd/yyyy hh:mm:ss a O')
    : '—'

  const details: { label: string; value: string | undefined }[] = [
    { label: 'Project ID', value: requirement.requirementId ?? undefined },
    { label: 'Global ID', value: requirement.id ? `GID-${requirement.id.slice(-5)}` : undefined },
    { label: 'Name', value: requirement.title },
    { label: 'Description', value: requirement.description || undefined },
    {
      label: 'Requirement Category',
      value: requirement.category ?? requirement.requirementType?.replace(/_/g, ' '),
    },
    { label: 'Rationale', value: requirement.rationale || undefined },
    { label: 'Verification Method', value: requirement.verificationMethod || undefined },
    {
      label: 'Status',
      value: requirement.reviewStatus ?? requirement.status ?? undefined,
    },
    { label: 'Derived?', value: requirement.source === 'Derived' ? 'Yes' : 'No' },
  ]

  const relationshipRows = links.map((link) => {
    const isOutgoing = link.sourceType === 'requirement' && link.sourceId === requirement.id
    const direction = isOutgoing ? 'Downstream' : 'Upstream'
    const itemId = isOutgoing ? (link.targetDisplayId ?? link.targetId?.slice(0, 8)) : (link.sourceDisplayId ?? link.sourceId?.slice(0, 8))
    const name = isOutgoing ? (link.targetTitle ?? link.targetId) : (link.sourceTitle ?? link.sourceId)
    const group = formatEntityType(isOutgoing ? (link.targetType as string) : (link.sourceType as string))
    const relationship = formatLinkType(link.linkType)
    return {
      itemId,
      name,
      direction,
      project: projectName ?? '—',
      group,
      relationship,
    }
  })

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          <span className="font-mono text-gray-600 dark:text-gray-400 mr-2">
            {requirement.requirementId ?? '—'}
          </span>
          <button
            type="button"
            onClick={() => onRequirementClick?.(requirement)}
            className={clsx(
              onRequirementClick &&
                'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer'
            )}
          >
            {requirement.title}
          </button>
        </h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Created: {createdFormatted} · Updated: {updatedFormatted}
        </p>
      </div>

      {/* Details section */}
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Requirement Details
        </h3>
        <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-600">
          <tbody>
            {details.map(({ label, value }) => (
              <tr key={label} className="border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                <td className="px-3 py-2 w-1/3 font-medium text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30">
                  {label}
                </td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                  {value ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Relationships section */}
      <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Relationships
        </h3>
        {relationshipRows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No relationships</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-600">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                    Item ID
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                    Direction
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                    Project
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                    Group
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                    Relationship
                  </th>
                </tr>
              </thead>
              <tbody>
                {relationshipRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-200 dark:border-gray-600 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-900/20"
                  >
                    <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                      {row.itemId}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.name}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.direction}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.project}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.group}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      {row.relationship}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
