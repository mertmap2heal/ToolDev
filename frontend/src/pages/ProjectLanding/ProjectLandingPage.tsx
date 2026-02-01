import { useParams } from 'react-router-dom'
import ProjectNavigation from '../../components/projects/ProjectNavigation'

export default function ProjectLandingPage() {
  const { projectId } = useParams<{ projectId: string }>()

  return (
    <div className="space-y-6">
      <ProjectNavigation />
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-gray-700 dark:text-gray-300">
          Select a section from the menu above to get started.
        </p>
      </div>
    </div>
  )
}
