import { useParams, Link } from 'react-router-dom'
import CustomOptionsManager from '../../components/verification/CustomOptionsManager'
import RequirementTypesManager from '../../components/requirements/RequirementTypesManager'
import { ArrowLeft } from 'lucide-react'

export default function RequirementsSettingsPage() {
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
            to={`/projects/${projectId}/requirements`}
            className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2"
          >
            <ArrowLeft size={16} />
            Back to Requirements
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Requirements Settings
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage project-level dropdown options for requirement type, level, risk, complexity, verification method, and source.
          </p>
        </div>
      </div>

      <RequirementTypesManager projectId={projectId} />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Baseline Options
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 -mt-2">
          Customize baseline types and review types used when creating baselines (aerospace: Functional/Allocated/Product, SRR/PDR/CDR).
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CustomOptionsManager
            projectId={projectId}
            optionType="BASELINE_TYPE"
            label="Baseline Type"
            description="e.g. Functional (SRR), Allocated (PDR), Product (CDR), Milestone, Custom"
          />
          <CustomOptionsManager
            projectId={projectId}
            optionType="BASELINE_REVIEW_TYPE"
            label="Baseline Review / Milestone"
            description="e.g. SRR, PDR, CDR for design reviews"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <CustomOptionsManager
          projectId={projectId}
          optionType="REQUIREMENT_LEVEL"
          label="Requirement Level"
          description="Used when creating or editing requirements (e.g., System, Subsystem, Component)"
        />
        <CustomOptionsManager
          projectId={projectId}
          optionType="RISK"
          label="Risk Level"
          description="Risk classification for requirements"
        />
        <CustomOptionsManager
          projectId={projectId}
          optionType="COMPLEXITY"
          label="Complexity"
          description="Complexity level of requirements"
        />
        <CustomOptionsManager
          projectId={projectId}
          optionType="VERIFICATION_METHOD"
          label="Verification Method"
          description="How requirements are verified (e.g., Test, Analysis, Inspection)"
        />
        <CustomOptionsManager
          projectId={projectId}
          optionType="SOURCE"
          label="Source"
          description="Origin of the requirement (e.g., Customer, Regulatory, Internal)"
        />
      </div>
    </div>
  )
}
