import { useState } from 'react'
import { Users, Shield, FolderOpen, Bookmark, ScrollText } from 'lucide-react'
import UsersTab from '../../components/admin/UsersTab'
import RolesTab from '../../components/admin/RolesTab'
import ProjectsTab from '../../components/admin/ProjectsTab'
import AuthoritiesTab from '../../components/admin/AuthoritiesTab'
import AuditLogTable from '../../components/admin/AuditLogTable'

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'roles', label: 'Roles', icon: Shield },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'authorities', label: 'Authorities', icon: Bookmark },
  { id: 'audit', label: 'Audit Log', icon: ScrollText },
] as const

type TabId = (typeof TABS)[number]['id']

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>('users')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Admin Panel
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          User & Permission Management
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-1 p-2" aria-label="Admin tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
        <div className="p-6">
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'roles' && <RolesTab />}
          {activeTab === 'projects' && <ProjectsTab />}
          {activeTab === 'authorities' && <AuthoritiesTab />}
          {activeTab === 'audit' && <AuditLogTable />}
        </div>
      </div>
    </div>
  )
}
