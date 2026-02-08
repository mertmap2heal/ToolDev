import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import * as adminService from '../../services/admin.service'
import type { AdminUser } from '../../types/admin.types'
import PermissionMatrix from './PermissionMatrix'

interface UserEditDrawerProps {
  user: AdminUser
  onClose: () => void
  onSaved: () => void
}

export default function UserEditDrawer({ user, onClose, onSaved }: UserEditDrawerProps) {
  const [status, setStatus] = useState<AdminUser['status']>(user.status)
  const [projects, setProjects] = useState<string[]>(user.projects)
  const [roles, setRoles] = useState<string[]>(user.roles)
  const [authorities, setAuthorities] = useState<string[]>(user.authorities)
  const [permissions, setPermissions] = useState(user.permissions ?? {})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStatus(user.status)
    setProjects([...user.projects])
    setRoles([...user.roles])
    setAuthorities([...user.authorities])
    setPermissions(user.permissions ?? {})
  }, [user])

  const { data: projectsList = [] } = useQuery({
    queryKey: ['admin', 'projects'],
    queryFn: () => adminService.getProjects(),
  })
  const { data: rolesList = [] } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => adminService.getRoles(),
  })
  const { data: authoritiesList = [] } = useQuery({
    queryKey: ['admin', 'authorities'],
    queryFn: () => adminService.getAuthorities(),
  })

  const toggleProject = (id: string) => {
    setProjects((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }
  const toggleRole = (id: string) => {
    setRoles((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    )
  }
  const toggleAuthority = (id: string) => {
    setAuthorities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminService.updateUser(user.id, {
        status,
        projects,
        roles,
        authorities,
        permissions,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-2xl min-w-[28rem] h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Edit User
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Profile
            </h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400">Username</label>
                <p className="text-sm font-mono text-gray-900 dark:text-white">{user.username}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AdminUser['status'])}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">Active</option>
                  <option value="disabled" className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white">Disabled</option>
                </select>
              </div>
            </div>
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Projects
            </h3>
            <div className="flex flex-wrap gap-2">
              {projectsList.map((p) => (
                <label
                  key={p.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-900 dark:text-white"
                >
                  <input
                    type="checkbox"
                    checked={projects.includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100">{p.name}</span>
                </label>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Roles
            </h3>
            <div className="flex flex-wrap gap-2">
              {rolesList.map((r) => (
                <label
                  key={r.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-900 dark:text-white"
                >
                  <input
                    type="checkbox"
                    checked={roles.includes(r.id)}
                    onChange={() => toggleRole(r.id)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100">{r.name}</span>
                </label>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Authorities
            </h3>
            <div className="flex flex-wrap gap-2">
              {authoritiesList.map((a) => (
                <label
                  key={a.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-900 dark:text-white"
                >
                  <input
                    type="checkbox"
                    checked={authorities.includes(a.id)}
                    onChange={() => toggleAuthority(a.id)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100">{a.name}</span>
                </label>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Permissions (explicit overrides)
            </h3>
            <PermissionMatrix value={permissions} onChange={setPermissions} />
          </section>
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Effective permissions
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Derived from assigned roles and authorities, with explicit overrides above applied.
              TODO: show merged read-only matrix when backend supports computed permissions.
            </p>
          </section>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
