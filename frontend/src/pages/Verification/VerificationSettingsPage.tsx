import { useParams } from 'react-router-dom'
import CustomOptionsManager from '../../components/verification/CustomOptionsManager'

export default function VerificationSettingsPage() {
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Verification Settings
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Manage project-level verification options for test plans, setups, and execution.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CustomOptionsManager
          projectId={projectId}
          optionType="ENVIRONMENT_TYPE"
          label="Environment Types"
          description="Used in test plans and setups (e.g., HIL, SIL, BENCH)"
        />
        <CustomOptionsManager
          projectId={projectId}
          optionType="TESTING_TOOL"
          label="Testing Tools"
          description="Tools used for execution (e.g., LabView, Vector)"
        />
      </div>
    </div>
  )
}
