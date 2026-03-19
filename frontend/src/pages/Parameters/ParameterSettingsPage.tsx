import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ParameterTypesPanel } from '../../components/parameters/ParameterTypesPanel'
import { ProjectUnitsPanel } from '../../components/parameters/ProjectUnitsPanel'

export default function ParameterSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()

  if (!projectId) {
    return (
      <div className="p-6 text-gray-500 dark:text-gray-400">
        Project not found
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to={`/projects/${projectId}/parameters`}
            className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2"
          >
            <ArrowLeft size={16} />
            Back to Parameters
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Parameter Settings
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage custom parameter types with value format guidance, and project-specific units.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Type Registry</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 -mt-1">
          Define custom data types used across parameters in this project. Each type can carry value format guidance (template, example, hint, validation pattern) shown at point of entry.
        </p>
        <ParameterTypesPanel projectId={projectId} />
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Unit Registry</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 -mt-1">
          Define custom measurement units for this project. These appear alongside standard engineering units in the unit picker.
        </p>
        <ProjectUnitsPanel projectId={projectId} />
      </div>
    </div>
  )
}
