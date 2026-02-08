import { useState } from 'react'
import { Bookmark, Plus } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as adminService from '../../services/admin.service'
import type { Authority } from '../../types/admin.types'
import AuthorityEditorModal from './AuthorityEditorModal'

export default function AuthoritiesTab() {
  const queryClient = useQueryClient()
  const [editorAuthority, setEditorAuthority] = useState<Authority | null | 'new'>(null)

  const { data: authorities = [], isLoading } = useQuery({
    queryKey: ['admin', 'authorities'],
    queryFn: () => adminService.getAuthorities(),
  })

  const handleSave = async (
    name: string,
    permissions: Authority['permissions'],
    opts?: { version?: string; deprecated?: boolean }
  ) => {
    if (editorAuthority === 'new') {
      await adminService.createAuthority(name, permissions, opts)
    } else if (editorAuthority?.id) {
      await adminService.updateAuthority(editorAuthority.id, {
        name,
        permissions,
        version: opts?.version,
        deprecated: opts?.deprecated,
      })
    }
    queryClient.invalidateQueries({ queryKey: ['admin', 'authorities'] })
  }

  const handleApplyTemplate = () => {
    // TODO: open modal to select users/roles and call applyAuthorityToUsers/applyAuthorityToRoles
    alert('Apply template to users/roles: TODO when backend supports it.')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleApplyTemplate}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Apply template to users/roles
        </button>
        <button
          type="button"
          onClick={() => setEditorAuthority('new')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <Plus size={16} />
          Create Authority
        </button>
      </div>
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading authorities...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Name</th>
                <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Version</th>
                <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Deprecated</th>
                <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {authorities.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                >
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                      <Bookmark size={14} className="text-gray-500" />
                      {a.name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{a.version ?? '—'}</td>
                  <td className="py-3 px-4">
                    {a.deprecated ? (
                      <span className="text-amber-600 dark:text-amber-400 text-xs">Yes</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => setEditorAuthority(a)}
                      className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editorAuthority && (
        <AuthorityEditorModal
          authority={editorAuthority === 'new' ? null : editorAuthority}
          onClose={() => setEditorAuthority(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
