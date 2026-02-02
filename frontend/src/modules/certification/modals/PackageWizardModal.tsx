import { useState, useEffect, useRef } from 'react'
import { X, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useCertificationStore } from '../store'
import { useFocusTrap } from '../useFocusTrap'

export type PackageType = 'Authority submission' | 'Customer review' | 'Internal readiness'

interface PackageWizardModalProps {
  isOpen: boolean
  onClose: () => void
  onShowToast: (message: string) => void
}

const PACKAGE_TYPES: PackageType[] = [
  'Authority submission',
  'Customer review',
  'Internal readiness',
]

const DELIVERABLES = [
  'Compliance Matrix (PDF)',
  'Certification Summary Report',
  'Evidence Index',
  'Configuration Index',
  'Audit Extract',
]

export default function PackageWizardModal({
  isOpen,
  onClose,
  onShowToast,
}: PackageWizardModalProps) {
  const { state, refetch } = useCertificationStore()
  const projectId = state.context.projectId
  const readinessGates = state.readinessGates.length > 0 ? state.readinessGates : [
    { id: 'gate-1', label: 'Configuration Frozen?', passed: true },
    { id: 'gate-2', label: 'Verification Evidence Linked?', passed: true },
    { id: 'gate-3', label: 'Safety Review Complete?', passed: true },
    { id: 'gate-4', label: 'No Open Major Findings?', passed: false, reason: 'Open Major finding(s)' },
  ]
  const [step, setStep] = useState(1)
  const [packageType, setPackageType] = useState<PackageType>('Authority submission')
  const [scopeBaseline, setScopeBaseline] = useState<string>('')
  const [scopeRelease, setScopeRelease] = useState<string>('')
  const [includedRegulations, setIncludedRegulations] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)

  const { context, baselines, releases, complianceMatrix, findings } = state
  const hasScope = context.selectedBaseline !== null || context.selectedRelease !== null
  const regRefs = complianceMatrix.map((r) => r.regRef)
  const majorOpen = findings.some(
    (f) => f.severity === 'Major' && (f.status === 'Open' || f.status === 'InProgress')
  )
  const gatesWithDerived = readinessGates.map((g) =>
    g.id === 'gate-4' ? { ...g, passed: !majorOpen } : g
  )
  const allGatesPassed = gatesWithDerived.every((g) => g.passed)

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setScopeBaseline(context.selectedBaseline?.baselineId ?? '')
      setScopeRelease(context.selectedRelease?.releaseId ?? '')
      setIncludedRegulations(new Set(regRefs))
    }
  }, [isOpen, context.selectedBaseline?.baselineId, context.selectedRelease?.releaseId, regRefs.join(',')])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !generating) onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose, generating])

  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef, isOpen)

  const toggleRegulation = (reg: string) => {
    setIncludedRegulations((prev) => {
      const next = new Set(prev)
      if (next.has(reg)) next.delete(reg)
      else next.add(reg)
      return next
    })
  }

  const handleGenerate = async () => {
    if (!projectId) {
      onShowToast('Select a project to generate a package.')
      return
    }
    setGenerating(true)
    try {
      const createRes = await createCertificationPackage(projectId, {
        packageType,
        scopeBaseline: scopeBaseline || null,
        scopeRelease: scopeRelease || null,
        includedRegulations: Array.from(includedRegulations),
        status: 'Draft',
      })
      if (!createRes.success || !createRes.data?.id) {
        onShowToast(createRes.error ?? 'Failed to create package.')
        setGenerating(false)
        return
      }
      const bundleRes = await downloadPackageBundle(projectId, createRes.data.id)
      if (bundleRes.success) {
        onShowToast('Package bundle download started. Check your downloads.')
        await refetch?.()
      } else {
        onShowToast(bundleRes.error ?? 'Bundle download failed.')
      }
    } finally {
      setGenerating(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={generating ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="package-wizard-title"
    >
      <div
        ref={containerRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 id="package-wizard-title" className="text-xl font-bold text-gray-900 dark:text-white">
            Certification Package
          </h2>
          {!generating && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              aria-label="Close"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>

        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => !generating && setStep(s)}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                step === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              Step {s}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Choose package type
              </h3>
              <div className="space-y-2">
                {PACKAGE_TYPES.map((t) => (
                  <label
                    key={t}
                    className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <input
                      type="radio"
                      name="packageType"
                      checked={packageType === t}
                      onChange={() => setPackageType(t)}
                      className="text-blue-600"
                    />
                    <span className="text-gray-900 dark:text-white">{t}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Select scope</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Baseline or release must be selected to generate package.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Baseline
                </label>
                <select
                  value={scopeBaseline}
                  onChange={(e) => setScopeBaseline(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">— Select —</option>
                  {baselines.map((b) => (
                    <option key={b.baselineId} value={b.baselineId}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Release
                </label>
                <select
                  value={scopeRelease}
                  onChange={(e) => setScopeRelease(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">— Select —</option>
                  {releases.map((r) => (
                    <option key={r.releaseId} value={r.releaseId}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Include regulations
                </label>
                <div className="flex flex-wrap gap-2">
                  {regRefs.map((reg) => (
                    <label key={reg} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={includedRegulations.has(reg)}
                        onChange={() => toggleRegulation(reg)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                      />
                      {reg}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Deliverables (preview)
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {DELIVERABLES.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Gating checks
              </h3>
              <div className="space-y-2">
                {gatesWithDerived.map((gate) => (
                  <div
                    key={gate.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {gate.passed ? (
                        <CheckCircle2 size={18} className="text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle size={18} className="text-red-600 dark:text-red-400" />
                      )}
                      <span className="text-sm text-gray-900 dark:text-white">{gate.label}</span>
                    </div>
                    {!gate.passed && gate.reason && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">{gate.reason}</span>
                    )}
                  </div>
                ))}
              </div>
              {!allGatesPassed && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Resolve failed gates before generating package.
                </p>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Generate</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Click Generate to create the certification package (placeholder). Download buttons
                will show a toast only.
              </p>
              {generating ? (
                <div className="flex items-center gap-3 py-6 text-gray-600 dark:text-gray-400">
                  <Loader2 size={24} className="animate-spin" />
                  <span>Generating…</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!allGatesPassed || (!scopeBaseline && !scopeRelease)}
                  title={
                    !allGatesPassed
                      ? 'Resolve gating checks first'
                      : !scopeBaseline && !scopeRelease
                        ? 'Select baseline or release'
                        : undefined
                  }
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg"
                >
                  Generate Package
                </button>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || generating}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Previous
          </button>
          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(5, s + 1))}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
