import { useEffect, useState } from 'react'
import { Users, FolderOpen, Shield, Bookmark, ListOrdered } from 'lucide-react'
import UsersTab from '../../components/admin/UsersTab'
import ProjectsTab from '../../components/admin/ProjectsTab'
import RolesTab from '../../components/admin/RolesTab'
import AuthoritiesTab from '../../components/admin/AuthoritiesTab'
import AuditLogTable from '../../components/admin/AuditLogTable'
import * as adminUserRoleService from '../../services/adminUserRole.service'

/**
 * One-shot migration (issue #166): copy any legacy localStorage role assignments
 * into the backend, then remove the key. Runs once per admin mount and is idempotent:
 * it will only POST roles that don't already exist on the server.
 */
const LEGACY_ADMIN_PROFILES_KEY = 'adminUserProfiles'

async function migrateLegacyAdminRoleAssignments(): Promise<void> {
  let raw: string | null
  try {
    raw = localStorage.getItem(LEGACY_ADMIN_PROFILES_KEY)
  } catch {
    return
  }
  if (!raw) return

  let profiles: Record<string, { roles?: string[] }>
  try {
    profiles = JSON.parse(raw)
  } catch {
    // Corrupt payload — drop it; role data is no longer read from localStorage.
    try {
      localStorage.removeItem(LEGACY_ADMIN_PROFILES_KEY)
    } catch {
      /* ignore */
    }
    return
  }

  try {
    const existing = await adminUserRoleService.listAssignments()
    const existingPairs = new Set(existing.map((a) => `${a.userId}::${a.adminRoleId}`))

    const toAssign: Array<{ userId: string; adminRoleId: string }> = []
    for (const [userId, profile] of Object.entries(profiles)) {
      const roles = profile?.roles ?? []
      for (const adminRoleId of roles) {
        if (!existingPairs.has(`${userId}::${adminRoleId}`)) {
          toAssign.push({ userId, adminRoleId })
        }
      }
    }

    // Server has at least one assignment already -> assume migration done elsewhere; bail.
    if (existing.length > 0 && toAssign.length === 0) {
      localStorage.removeItem(LEGACY_ADMIN_PROFILES_KEY)
      return
    }

    for (const pair of toAssign) {
      try {
        await adminUserRoleService.assignRole(pair.userId, pair.adminRoleId)
      } catch (err) {
        // 409 duplicate is fine; other errors we swallow so migration doesn't block page load.
        console.warn('[admin #166] role migration skipped', pair, err)
      }
    }
    localStorage.removeItem(LEGACY_ADMIN_PROFILES_KEY)
  } catch (err) {
    console.warn('[admin #166] role migration failed', err)
  }
}

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'roles', label: 'Roles', icon: Shield },
  { id: 'authorities', label: 'Authorities', icon: Bookmark },
  { id: 'audit', label: 'Audit Log', icon: ListOrdered },
] as const

type TabId = (typeof TABS)[number]['id']

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('users')

  // One-shot migration of legacy localStorage role assignments to the backend.
  useEffect(() => {
    void migrateLegacyAdminRoleAssignments()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Admin Panel</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage projects, roles, authorities, and view the audit log.
        </p>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-1" aria-label="Admin tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[200px]">
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'projects' && <ProjectsTab />}
        {activeTab === 'roles' && <RolesTab />}
        {activeTab === 'authorities' && <AuthoritiesTab />}
        {activeTab === 'audit' && <AuditLogTable />}
      </div>
    </div>
  )
}
