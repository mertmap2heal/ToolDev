import { useState } from 'react'
import { Users, FolderOpen, Shield, Bookmark, ListOrdered } from 'lucide-react'
import UsersTab from '../../components/admin/UsersTab'
import ProjectsTab from '../../components/admin/ProjectsTab'
import RolesTab from '../../components/admin/RolesTab'
import AuthoritiesTab from '../../components/admin/AuthoritiesTab'
import AuditLogTable from '../../components/admin/AuditLogTable'

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
