import { useState } from 'react'
import { Package, FileDown, Download } from 'lucide-react'
import { useCertificationStore } from '../store'
import { canGeneratePackage } from '../certificationPermissions'
import PackageWizardModal from '../modals/PackageWizardModal'
import {
  downloadComplianceMatrix,
  downloadSummaryPdf,
  downloadEvidenceIndex,
  downloadActivityLog,
} from '../../../services/certification.service'

interface CertificationPackageTabProps {
  onShowToast?: (message: string) => void
}

export default function CertificationPackageTab({ onShowToast }: CertificationPackageTabProps) {
  const { state } = useCertificationStore()
  const [wizardOpen, setWizardOpen] = useState(false)
  const projectId = state.context.projectId

  const { context, findings, readinessGates } = state
  const hasScope = context.selectedBaseline !== null || context.selectedRelease !== null
  const majorOpen = findings.some(
    (f) => f.severity === 'Major' && (f.status === 'Open' || f.status === 'InProgress')
  )
  const gates = readinessGates.length > 0 ? readinessGates : [
    { id: 'gate-1', label: 'Configuration Frozen?', passed: true },
    { id: 'gate-2', label: 'Verification Evidence Linked?', passed: true },
    { id: 'gate-3', label: 'Safety Review Complete?', passed: true },
    { id: 'gate-4', label: 'No Open Major Findings?', passed: false, reason: 'Open Major finding(s)' },
  ]
  const gatesWithDerived = gates.map((g) =>
    g.id === 'gate-4' ? { ...g, passed: !majorOpen } : g
  )
  const allGatesPassed = gatesWithDerived.every((g) => g.passed)
  const canGenerate = hasScope && allGatesPassed && canGeneratePackage(state)

  const handleDownload = async (
    fn: () => Promise<{ success: boolean; error?: string }>,
    label: string
  ) => {
    if (!projectId) {
      onShowToast?.('Select a project to download.')
      return
    }
    const res = await fn()
    if (res.success) onShowToast?.(`Download "${label}" started. Check your downloads.`)
    else onShowToast?.(res.error ?? `Download "${label}" failed.`)
  }

  if (!hasScope) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select a baseline or release in the context selector above to view certification readiness and data.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Authority deliverables
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Build a certification package for authority submission, customer review, or internal
          readiness. Select baseline or release and ensure all gating checks pass.
        </p>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          disabled={!canGenerate}
          title={
            !hasScope
              ? 'Select baseline or release first'
              : !allGatesPassed
                ? 'Resolve gating checks (e.g. close Major findings)'
                : !canGeneratePackage(state)
                  ? state.readOnlyMode
                    ? 'Read-only mode is on'
                    : 'Only Certification Manager can generate package'
                  : undefined
          }
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg"
        >
          <Package size={18} />
          Generate Certification Package
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Download deliverables
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Export compliance matrix, summary, evidence index, or activity log. Configuration Index is not yet implemented.
          </p>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleDownload(() => downloadComplianceMatrix(projectId!, 'pdf'), 'Compliance Matrix (PDF)')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <FileDown size={16} />
            Compliance Matrix (PDF)
          </button>
          <button
            type="button"
            onClick={() => handleDownload(() => downloadSummaryPdf(projectId!), 'Certification Summary Report')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download size={16} />
            Certification Summary Report
          </button>
          <button
            type="button"
            onClick={() => handleDownload(() => downloadEvidenceIndex(projectId!, 'xlsx'), 'Evidence Index')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download size={16} />
            Evidence Index
          </button>
          <button
            type="button"
            onClick={() => onShowToast?.('Configuration Index export is not yet implemented.')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download size={16} />
            Configuration Index
          </button>
          <button
            type="button"
            onClick={() => handleDownload(() => downloadActivityLog(projectId!, 'xlsx'), 'Audit Extract')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Download size={16} />
            Audit Extract
          </button>
        </div>
      </div>

      <PackageWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onShowToast={onShowToast ?? (() => {})}
      />
    </div>
  )
}
