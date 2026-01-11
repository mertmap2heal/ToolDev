import { MoreVertical } from 'lucide-react'
import type { Project } from '../../../shared/types/project.types'

interface ProjectCardProps {
  project: Project
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{project.name}</h3>
        <button className="p-1 hover:bg-gray-100 rounded">
          <MoreVertical size={16} className="text-gray-600" />
        </button>
      </div>
      
      {project.progress > 0 && (
        <div className="mb-3">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress {project.progress}%</span>
            <span>{project.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      )}

      {project.teamMembers && project.teamMembers.length > 0 && (
        <div className="mb-3">
          <p className="text-sm text-gray-600 mb-2">Team</p>
          <div className="flex -space-x-2">
            {project.teamMembers.slice(0, 4).map((member) => {
              const initials = member.user?.name
                ?.split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2) || 'U'
              return (
                <div
                  key={member.id}
                  className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs border-2 border-white"
                >
                  {initials}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {project.status && (
        <div className="mb-3">
          <p className="text-sm text-gray-600 mb-1">Status</p>
          <span className="inline-block px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
            {project.status}
          </span>
        </div>
      )}

      {project.deadline && (
        <div className="mb-3">
          <p className="text-sm text-gray-600">
            Deadline: {new Date(project.deadline).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
      )}

      {project.companyName && (
        <p className="text-sm text-gray-600">{project.companyName}</p>
      )}
    </div>
  )
}
