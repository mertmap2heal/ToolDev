import { useState } from 'react'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import * as adminService from '../../services/admin.service'
import { emptyPermissionMap } from '../../types/admin.types'
import type { PermissionMap } from '../../types/admin.types'
import PermissionMatrix from './PermissionMatrix'

interface UserCreateModalProps {
  onClose: () => void
  onCreated: (username: string, generatedPassword: string) => void
}

export default function UserCreateModal({ onClose, onCreated }: UserCreateModalProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedAuthorities, setSelectedAuthorities] = useState<string[]>([])
  const [permissions, setPermissions] = useState<PermissionMap>(() => emptyPermissionMap())
  const [submitting, setSubmitting] = useState(false)

  const { data: projects = [] } = useQuery({
    queryKey: ['admin', 'projects'],
    queryFn: () => adminService.getProjects(),
  })
  const { data: roles = [] } = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => adminService.getRoles(),
  })
  const { data: authorities = [] } = useQuery({
    queryKey: ['admin', 'authorities'],
    queryFn: () => adminService.getAuthorities(),
  })

  const toggleProject = (id: string) => {
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }
  const toggleRole = (id: string) => {
    setSelectedRoles((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    )
  }
  const toggleAuthority = (id: string) => {
    setSelectedAuthorities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return
    }
    setSubmitting(true)
    try {
      const result = await adminService.createUser({
        email: trimmedEmail,
        name: name.trim() || undefined,
        projects: selectedProjects,
        roles: selectedRoles,
        authorities: selectedAuthorities,
        permissions,
      })
      onCreated(result.user.username, result.generatedPassword)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Create User
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
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Email (required)
            </h3>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Display name (optional)
            </h3>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Projects
            </h3>
            <div className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <label
                  key={p.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedProjects.includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm">{p.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Roles
            </h3>
            <div className="flex flex-wrap gap-2">
              {roles.map((r) => (
                <label
                  key={r.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r.id)}
                    onChange={() => toggleRole(r.id)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm">{r.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Authorities (Permission Templates)
            </h3>
            <div className="flex flex-wrap gap-2">
              {authorities.map((a) => (
                <label
                  key={a.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedAuthorities.includes(a.id)}
                    onChange={() => toggleAuthority(a.id)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm">{a.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Explicit permissions (overrides)
            </h3>
            <PermissionMatrix value={permissions} onChange={setPermissions} />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !email.trim().includes('@')}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
          >
            {submitting ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}
