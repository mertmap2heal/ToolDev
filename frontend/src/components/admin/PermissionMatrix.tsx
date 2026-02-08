import { useCallback } from 'react'
import {
  PERMISSION_GROUPS,
  type PermissionMap,
  type PermissionGroupId,
} from '../../types/admin.types'

function isActionChecked(value: PermissionMap, groupId: PermissionGroupId, action: string): boolean {
  return !!value[groupId]?.[action]
}

function countGroupChecked(value: PermissionMap, groupId: PermissionGroupId): number {
  const actions = PERMISSION_GROUPS[groupId].actions
  return actions.filter((a) => isActionChecked(value, groupId, a)).length
}

function setGroup(value: PermissionMap, groupId: PermissionGroupId, checked: boolean): PermissionMap {
  const actions = PERMISSION_GROUPS[groupId].actions
  const next: PermissionMap = { ...value }
  next[groupId] = { ...(next[groupId] ?? {}) }
  actions.forEach((a) => {
    next[groupId]![a] = checked
  })
  return next
}

function setAction(
  value: PermissionMap,
  groupId: PermissionGroupId,
  action: string,
  checked: boolean
): PermissionMap {
  const next: PermissionMap = { ...value }
  next[groupId] = { ...(next[groupId] ?? {}), [action]: checked }
  return next
}

function setAll(_value: PermissionMap, checked: boolean): PermissionMap {
  const next: PermissionMap = {}
  ;(Object.keys(PERMISSION_GROUPS) as PermissionGroupId[]).forEach((g) => {
    const actions = PERMISSION_GROUPS[g].actions
    const groupMap: Record<string, boolean> = {}
    actions.forEach((a) => {
      groupMap[a] = checked
    })
    next[g] = groupMap
  })
  return next
}

function totalActions(): number {
  return (Object.keys(PERMISSION_GROUPS) as PermissionGroupId[]).reduce(
    (sum, g) => sum + PERMISSION_GROUPS[g].actions.length,
    0
  )
}

function totalChecked(value: PermissionMap): number {
  return (Object.keys(PERMISSION_GROUPS) as PermissionGroupId[]).reduce(
    (sum, g) => sum + countGroupChecked(value, g),
    0
  )
}

export interface PermissionMatrixProps {
  value: PermissionMap
  onChange: (value: PermissionMap) => void
  /** Optional: groupId -> "Inherited: Role X" or similar */
  inherited?: Partial<Record<PermissionGroupId, string>>
}

export default function PermissionMatrix({ value, onChange, inherited }: PermissionMatrixProps) {
  const handleSelectAll = useCallback(
    (checked: boolean) => {
      onChange(setAll(value, checked))
    },
    [value, onChange]
  )

  const handleGroupChange = useCallback(
    (groupId: PermissionGroupId, checked: boolean) => {
      onChange(setGroup(value, groupId, checked))
    },
    [value, onChange]
  )

  const handleActionChange = useCallback(
    (groupId: PermissionGroupId, action: string, checked: boolean) => {
      onChange(setAction(value, groupId, action, checked))
    },
    [value, onChange]
  )

  const total = totalActions()
  const checkedTotal = totalChecked(value)
  const selectAllChecked = total > 0 && checkedTotal === total
  const selectAllIndeterminate = checkedTotal > 0 && checkedTotal < total

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={selectAllChecked}
            ref={(el) => {
              if (el) el.indeterminate = selectAllIndeterminate
            }}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          Select all permissions
        </label>
      </div>

      <div className="space-y-3">
        {(Object.keys(PERMISSION_GROUPS) as PermissionGroupId[]).map((groupId) => {
          const group = PERMISSION_GROUPS[groupId]
          const groupChecked = countGroupChecked(value, groupId)
          const groupTotal = group.actions.length
          const groupAllChecked = groupTotal > 0 && groupChecked === groupTotal
          const groupIndeterminate = groupChecked > 0 && groupChecked < groupTotal
          const inheritLabel = inherited?.[groupId]

          return (
            <div
              key={groupId}
              className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50/50 dark:bg-gray-800/50"
            >
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={groupAllChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = groupIndeterminate
                    }}
                    onChange={(e) => handleGroupChange(groupId, e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  {group.label}
                </label>
                {inheritLabel && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    Inherited: {inheritLabel}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 pl-6">
                {group.actions.map((action) => (
                  <label
                    key={action}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isActionChecked(value, groupId, action)}
                      onChange={(e) =>
                        handleActionChange(groupId, action, e.target.checked)
                      }
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="capitalize text-gray-700 dark:text-gray-200">
                      {action.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
