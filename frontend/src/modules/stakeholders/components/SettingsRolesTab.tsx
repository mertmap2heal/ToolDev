import { Check, X } from 'lucide-react'
import type { StakeholderRole } from '../types'
import { useStakeholdersStore } from '../store'
import { canEditStakeholders, canEditGovernance, canEditAny } from '../permissions'

const ROLES: StakeholderRole[] = ['Admin', 'ProgramManager', 'Auditor', 'Engineer']

const ACTIONS = [
  { id: 'createStakeholder', label: 'Create stakeholder' },
  { id: 'editStakeholder', label: 'Edit stakeholder' },
  { id: 'editCommittee', label: 'Edit committee / membership' },
  { id: 'createRaci', label: 'Create / edit RACI' },
  { id: 'editRules', label: 'Create / edit / disable approval rules' },
  { id: 'createRequest', label: 'Create / update request' },
  { id: 'postComm', label: 'Post announcement' },
] as const

function canDo(actionId: string, role: StakeholderRole, strictMode: boolean, readOnlyMode: boolean): boolean {
  if (readOnlyMode) return false
  switch (actionId) {
    case 'createStakeholder':
    case 'editStakeholder':
      return canEditStakeholders(role, readOnlyMode)
    case 'editCommittee':
    case 'editRules':
      return canEditGovernance(role, strictMode, readOnlyMode)
    case 'createRaci':
    case 'createRequest':
    case 'postComm':
      return canEditAny(role, readOnlyMode)
    default:
      return false
  }
}

export default function SettingsRolesTab() {
  const { state, dispatch } = useStakeholdersStore()

  return (
    <div className="space-y-6 max-w-4xl">
      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Role simulation</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Change role to simulate permissions. This only affects the Stakeholders module (client-side).
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current role:</span>
          <select
            value={state.role}
            onChange={(e) => dispatch({ type: 'SET_ROLE', payload: e.target.value as StakeholderRole })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Permissions matrix</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Role vs allowed actions. Strict Mode restricts governance (rules, groups) to Admin and Program Manager.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-900 dark:text-white">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Action</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-4 py-2 text-center text-gray-500 dark:text-gray-400">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {ACTIONS.map((action) => (
                <tr key={action.id}>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{action.label}</td>
                  {ROLES.map((role) => {
                    const allowed = canDo(action.id, role, state.strictMode, state.readOnlyMode)
                    return (
                      <td key={role} className="px-4 py-2 text-center">
                        {allowed ? (
                          <Check size={18} className="inline text-green-600 dark:text-green-400" />
                        ) : (
                          <X size={18} className="inline text-gray-300 dark:text-gray-600" />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Mode toggles</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.strictMode}
              onChange={(e) => dispatch({ type: 'SET_STRICT_MODE', payload: e.target.checked })}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Strict Mode</span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
            Only Admin and Program Manager can edit governance (approval rules, committees, membership).
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={state.readOnlyMode}
              onChange={(e) => dispatch({ type: 'SET_READ_ONLY_MODE', payload: e.target.checked })}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Read-only Mode</span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
            All write actions are disabled (auditor view). Data remains viewable.
          </p>
        </div>
      </section>
    </div>
  )
}
