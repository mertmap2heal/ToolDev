import { useState } from 'react'
import { Search, Filter, ArrowDownUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import ProjectGrid from '../../components/projects/ProjectGrid'
import CreateProjectButton from '../../components/projects/CreateProjectButton'
import { projectService } from '../../services/project.service'
import { useProjectStore } from '../../store/projectStore'

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterValue, setFilterValue] = useState('all')
  const [sortValue, setSortValue] = useState('name')
  const { setProjects } = useProjectStore()

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await projectService.getProjects()
      if (response.success && response.data) {
        setProjects(response.data)
        return response.data
      }
      return []
    },
  })

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search Project
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Name of the Searched Project"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <button className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <span>Filter</span>
              <Filter size={16} className="text-gray-400" />
            </button>
          </div>
          <div className="flex-1">
            <button className="w-full flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <span>Sort by</span>
              <ArrowDownUp size={16} className="text-gray-400" />
            </button>
          </div>
        </div>
      </div>
      {isLoading ? (
        <div className="text-center py-8">Loading projects...</div>
      ) : (
        <ProjectGrid
          projects={projects || []}
          searchQuery={searchQuery}
          filterValue={filterValue}
          sortValue={sortValue}
        />
      )}
      <CreateProjectButton />
    </div>
  )
}
