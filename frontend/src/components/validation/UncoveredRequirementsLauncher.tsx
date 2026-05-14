import { useQuery } from '@tanstack/react-query'
import CreateFromRequirementsModal from './CreateFromRequirementsModal'
import { validationService } from '../../services/validation.service'

interface Props {
  projectId: string
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

/**
 * Thin wrapper that fetches the uncovered-requirements list and feeds the
 * CreateFromRequirementsModal a restricted set of ids. Lets the user blast
 * through coverage gaps without scrolling the full requirements list.
 */
export default function UncoveredRequirementsLauncher({
  projectId,
  isOpen,
  onClose,
  onCreated,
}: Props) {
  const { data = [] } = useQuery({
    queryKey: ['validation-uncovered', projectId],
    enabled: isOpen,
    queryFn: async () => {
      const res = await validationService.uncoveredRequirements(projectId)
      return res.success && res.data ? res.data : []
    },
  })

  if (!isOpen) return null
  return (
    <CreateFromRequirementsModal
      projectId={projectId}
      isOpen={isOpen}
      onClose={onClose}
      onCreated={onCreated}
      restrictToRequirementIds={data.map((r) => r.id)}
      title="Cover the gap — requirements without validation"
    />
  )
}
