import { useCertificationStore } from '../store'
import type { CertRole } from '../types'

const ROLES: CertRole[] = [
  'CertificationManager',
  'ComplianceEngineer',
  'SystemEngineer',
  'VerificationEngineer',
  'SafetyEngineer',
  'Auditor',
]

const ACTIONS = [
  'Create finding',
  'Close finding',
  'Generate package',
  'Edit objective status',
  'Start review',
  'Close review',
] as const

// Role -> which actions are allowed (Auditor is read-only)
const ROLE_PERMISSIONS: Record<CertRole, Record<string, boolean>> = {
  CertificationManager: {
    'Create finding': true,
    'Close finding': true,
    'Generate package': true,
    'Edit objective status': true,
    'Start review': true,
    'Close review': true,
  },
  ComplianceEngineer: {
    'Create finding': true,
    'Close finding': true,
    'Generate package': false,
    'Edit objective status': true,
    'Start review': true,
    'Close review': false,
  },
  SystemEngineer: {
    'Create finding': true,
    'Close finding': false,
    'Generate package': false,
    'Edit objective status': true,
    'Start review': false,
    'Close review': false,
  },
  VerificationEngineer: {
    'Create finding': true,
    'Close finding': false,
    'Generate package': false,
    'Edit objective status': true,
    'Start review': true,
    'Close review': false,
  },
  SafetyEngineer: {
    'Create finding': true,
    'Close finding': false,
    'Generate package': false,
    'Edit objective status': true,
    'Start review': false,
    'Close review': false,
  },
  Auditor: {
    'Create finding': false,
    'Close finding': false,
    'Generate package': false,
    'Edit objective status': false,
    'Start review': false,
    'Close review': false,
  },
}

export default function SettingsRolesTab() {
  const { state, dispatch } = useCertificationStore()
  const { role, strictAuditMode, readOnlyMode } = state

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Role switcher
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Affects Certification module only. Determines which actions are enabled in the UI.
        </p>
        <select
          value={role}
          onChange={(e) => dispatch({ type: 'SET_ROLE', payload: e.target.value as CertRole })}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Permissions matrix (actions × roles)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Checkmark = allowed for that role. Auditor is read-only.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Action
                </th>
                {ROLES.map((r) => (
                  <th
                    key={r}
                    className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
                  >
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {ACTIONS.map((action) => (
                <tr key={action}>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{action}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-4 py-2 text-center">
                      {ROLE_PERMISSIONS[r][action] ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">Yes</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Toggles</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Strict Audit Mode
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Adds confirmations and disables edits unless role allows
            </span>
            <input
              type="checkbox"
              checked={strictAuditMode}
              onChange={(e) =>
                dispatch({ type: 'SET_STRICT_AUDIT_MODE', payload: e.target.checked })
              }
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
            />
          </label>
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <span className="text-sm text-gray-700 dark:text-gray-300">Read-only Mode</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Forces read-only even if role is manager
            </span>
            <input
              type="checkbox"
              checked={readOnlyMode}
              onChange={(e) =>
                dispatch({ type: 'SET_READ_ONLY_MODE', payload: e.target.checked })
              }
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
