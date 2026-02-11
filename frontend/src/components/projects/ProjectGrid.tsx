import { useNavigate } from 'react-router-dom'
import ProjectCard from './ProjectCard'
import type { Project } from 'shared/types/project.types'

interface ProjectGridProps {
  projects: Project[]
  searchQuery: string
  filterValue: string
  sortValue: string
}

export default function ProjectGrid({ projects, searchQuery, filterValue, sortValue }: ProjectGridProps) {
  const navigate = useNavigate()

  const filteredProjects = projects
    .filter((project) => {
      if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      if (filterValue !== 'all' && project.status !== filterValue) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      switch (sortValue) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'date':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        case 'progress':
          return b.progress - a.progress
        default:
          return 0
      }
    })

  if (filteredProjects.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        {projects.length === 0 ? (
          <div>
            <p className="text-lg mb-2">No projects found.</p>
            <p className="text-sm">Create your first project to get started, or check your connection to the backend API.</p>
          </div>
        ) : (
          <p>No projects match your search criteria.</p>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {filteredProjects.map((project) => (
        <div
          key={project.id}
          onClick={() => navigate(`/projects/${project.id}`)}
          className="cursor-pointer"
        >
          <ProjectCard project={project} />
        </div>
      ))}
    </div>
  )
}
