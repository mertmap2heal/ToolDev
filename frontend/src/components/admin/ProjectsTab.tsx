import { useState, useMemo } from 'react'
import { FolderOpen, Plus, Key } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as adminService from '../../services/admin.service'
import { authService } from '../../services/auth.service'
import { projectService } from '../../services/project.service'
import type { AdminProject } from '../../types/admin.types'
import ProjectEditorModal from './ProjectEditorModal'
import McpKeysPanel from './McpKeysPanel'

export default function ProjectsTab() {
  const queryClient = useQueryClient()
  const [editorProject, setEditorProject] = useState<AdminProject | null | 'new'>(null)
  const [mcpProject, setMcpProject] = useState<AdminProject | null>(null)

  const {
    data: projects = [],
    isLoading,
    isError: projectsError,
    error: projectsErrorMessage,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: ['admin', 'projects'],
    queryFn: () => adminService.getProjects(),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin', 'authUsers'],
    queryFn: () => authService.getUsersAsAdminUsers(),
  })

  const userNames = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.name || u.username])),
    [users]
  )

  const handleSave = async (name: string, members: string[], aiEnabled: boolean) => {
    if (editorProject === 'new') {
      const created = await adminService.createProject(name, members)
      if (aiEnabled) {
        await adminService.updateProject(created.id, { aiEnabled: true })
      }
      for (const userId of members) {
        const res = await projectService.addProjectMember(created.id, userId, 'member')
        if (!res.success) throw new Error(res.error || 'Failed to add member')
      }
    } else if (editorProject?.id) {
      const nameChanged = name.trim() !== editorProject.name
      const aiChanged = aiEnabled !== (editorProject.aiEnabled ?? false)
      if (nameChanged || aiChanged) {
        await adminService.updateProject(editorProject.id, {
          ...(nameChanged ? { name } : {}),
          ...(aiChanged ? { aiEnabled } : {}),
        })
      }
      const previousIds = new Set(editorProject.members)
      const nextIds = new Set(members)
      for (const userId of nextIds) {
        if (!previousIds.has(userId)) {
          const res = await projectService.addProjectMember(editorProject.id, userId, 'member')
          if (!res.success) throw new Error(res.error || 'Failed to add member')
        }
      }
      for (const userId of previousIds) {
        if (!nextIds.has(userId)) {
          const res = await projectService.removeProjectMember(editorProject.id, userId)
          if (!res.success) throw new Error(res.error || 'Failed to remove member')
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ['admin', 'projects'] })
  }

  return (
    <div className="space-y-4">
      {projectsError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-red-700 dark:text-red-300">
            {projectsErrorMessage instanceof Error
              ? projectsErrorMessage.message
              : 'Failed to load projects from server.'}
            {' '}
            Make sure you are logged in and the backend is running.
          </p>
          <button
            type="button"
            onClick={() => refetchProjects()}
            className="shrink-0 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            Retry
          </button>
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditorProject('new')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
        >
          <Plus size={16} />
          Create Project
        </button>
      </div>
      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">Loading projects...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Name</th>
                <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Members</th>
                <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">AI</th>
                <th className="py-3 px-4 font-medium text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
                >
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                      <FolderOpen size={14} className="text-gray-500" />
                      {project.name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                    {project.members.length === 0
                      ? '—'
                      : project.members
                          .map((id) => userNames[id] || id)
                          .filter(Boolean)
                          .join(', ')}
                  </td>
                  <td className="py-3 px-4">
                    {project.aiEnabled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">
                        On
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        Off
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditorProject(project)}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                      >
                        Edit
                      </button>
                      {project.aiEnabled && (
                        <button
                          type="button"
                          onClick={() => setMcpProject(project)}
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                          title="Manage MCP keys for Claude Desktop / MCP agents"
                        >
                          <Key size={12} />
                          MCP keys
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editorProject && (
        <ProjectEditorModal
          project={editorProject === 'new' ? null : editorProject}
          users={users}
          onClose={() => setEditorProject(null)}
          onSave={handleSave}
        />
      )}
      {mcpProject && (
        <McpKeysPanel
          projectId={mcpProject.id}
          projectName={mcpProject.name}
          onClose={() => setMcpProject(null)}
        />
      )}
    </div>
  )
}
