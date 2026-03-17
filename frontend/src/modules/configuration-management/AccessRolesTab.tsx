import { useCMStore } from './store'
import type { CMRole } from './types'
import { CM_ROLES, ROLE_PERMISSIONS, type CMActionId } from './constants'
import { Check, X } from 'lucide-react'

const ACTION_LABELS: Record<CMActionId, string> = {
  create_ci: 'Create CI', edit_ci: 'Edit CI', delete_ci: 'Delete CI',
  freeze_baseline: 'Freeze baseline', approve_baseline: 'Approve baseline', create_baseline: 'Create baseline',
  approve_cr: 'Approve change request', reject_cr: 'Reject change request', apply_cr_versions: 'Apply CR version updates',
  create_cr: 'Create change request', create_release: 'Create release', approve_release: 'Approve release',
  create_dw: 'Create deviation/waiver', approve_dw: 'Approve deviation/waiver', reject_dw: 'Reject deviation/waiver',
}

const ACTIONS: CMActionId[] = [
  'create_ci', 'edit_ci', 'delete_ci', 'create_baseline', 'freeze_baseline', 'approve_baseline',
  'create_cr', 'approve_cr', 'reject_cr', 'apply_cr_versions', 'create_release', 'approve_release',
  'create_dw', 'approve_dw', 'reject_dw',
]

export default function AccessRolesTab() {
  const { state, dispatch: cmDispatch } = useCMStore()
  const { currentRole, strictMode, auditMode } = state

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Role switcher</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Simulated role for this page only.</p>
        <select value={currentRole} onChange={(e) => cmDispatch({ type: 'SET_ROLE', payload: e.target.value as CMRole })} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
          {CM_ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
        </select>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Option toggles</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={strictMode} onChange={(e) => cmDispatch({ type: 'SET_STRICT_MODE', payload: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600 text-blue-600" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Strict mode — only ConfigManager can edit</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer mt-2">
          <input type="checkbox" checked={auditMode} onChange={(e) => cmDispatch({ type: 'SET_AUDIT_MODE', payload: e.target.checked })} className="rounded border-gray-300 dark:border-gray-600 text-blue-600" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Audit mode — extra confirmations</span>
        </label>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Permissions matrix</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Rows = actions, columns = roles.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase sticky left-0 bg-gray-50 dark:bg-gray-900 z-10">Action</th>
                {CM_ROLES.map((r) => (<th key={r} className={`px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase min-w-[100px] ${r === currentRole ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>{r}</th>))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {ACTIONS.map((action) => (
                <tr key={action}>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-800 z-10">{ACTION_LABELS[action]}</td>
                  {CM_ROLES.map((role) => {
                    const allowed = ROLE_PERMISSIONS[action]?.includes(role) ?? false
                    return (<td key={role} className={`px-4 py-2 text-center min-w-[100px] ${role === currentRole ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                      {allowed ? <Check size={18} className="inline text-green-600 dark:text-green-400" /> : <X size={18} className="inline text-gray-300 dark:text-gray-600" />}
                    </td>)
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
