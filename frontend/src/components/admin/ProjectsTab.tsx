import { useState } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as adminService from '../../services/admin.service'
import type { AdminProject } from '../../types/admin.types'
import ProjectEditorModal from './ProjectEditorModal'

export default function ProjectsTab() {
  const queryClient = useQueryClient()
  const [editorProject, setEditorProject] = useState<AdminProject | null | 'new'>(null)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['admin', 'projects'],
    queryFn: () => adminService.getProjects(),
  })

  const handleSave = async (name: string, members: string[]) => {
    if (editorProject === 'new') {
      await adminService.createProject(name, members)
    } else if (editorProject?.id) {
      await adminService.updateProject(editorProject.id, { name, members })
    }
    queryClient.invalidateQueries({ queryKey: ['admin', 'projects'] })
  }

  return (
    <div className="space-y-4">
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
                    {project.members.length} member(s)
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => setEditorProject(project)}
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
      {editorProject && (
        <ProjectEditorModal
          project={editorProject === 'new' ? null : editorProject}
          onClose={() => setEditorProject(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
