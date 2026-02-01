import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  X,
  ChevronDown,
  ChevronRight,
  FileText,
  Network,
  AlertCircle,
  GitBranch,
  CheckCircle2,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react'
import clsx from 'clsx'
import type { Risk, RiskStatus } from './types'
import {
  RISK_STATUSES,
  CLASSIFICATIONS,
  ARTIFACT_ROUTES,
  MOCK_ARTIFACT_COUNTS,
  getStatusColor,
  getClassificationColor,
  exposureToClassification,
} from './constants'
import PlannedFeatureModal from './PlannedFeatureModal'

const ARTIFACT_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Requirements: FileText,
  Interfaces: Network,
  Issues: AlertCircle,
  'Change Requests': GitBranch,
  'Verification Activities': CheckCircle2,
  'Configuration Baseline': Layers,
}

interface RiskDetailDrawerProps {
  isOpen: boolean
  risk: Risk | null
  onClose: () => void
  onUpdate: (risk: Risk) => void
  onDelete?: (risk: Risk) => void
}

export default function RiskDetailDrawer({ isOpen, risk, onClose, onUpdate, onDelete }: RiskDetailDrawerProps) {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [description, setDescription] = useState('')
  const [likelihood, setLikelihood] = useState(3)
  const [impact, setImpact] = useState(3)
  const [status, setStatus] = useState<RiskStatus>('Open')
  const [mitigationDescription, setMitigationDescription] = useState('')
  const [mitigationActions, setMitigationActions] = useState<string[]>([])
  const [mitigationTargetDate, setMitigationTargetDate] = useState('')
  const [residualRiskRating, setResidualRiskRating] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [acceptanceRationale, setAcceptanceRationale] = useState('')
  const [acceptedBy, setAcceptedBy] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['overview', 'assessment', 'mitigation', 'linked', 'acceptance'])
  )
  const [newActionText, setNewActionText] = useState('')
  const [isPlannedFeatureOpen, setIsPlannedFeatureOpen] = useState(false)

  useEffect(() => {
    if (risk) {
      setDescription(risk.description ?? '')
      setLikelihood(risk.likelihood)
      setImpact(risk.impact)
      setStatus(risk.status)
      setMitigationDescription(risk.mitigationDescription ?? '')
      setMitigationActions(risk.mitigationActions ?? [])
      setMitigationTargetDate(risk.mitigationTargetDate ?? '')
      setResidualRiskRating(risk.residualRiskRating ?? '')
      setAccepted(risk.accepted ?? false)
      setAcceptanceRationale(risk.acceptanceRationale ?? '')
      setAcceptedBy(risk.acceptedBy ?? '')
    }
  }, [risk])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exposure = likelihood * impact
  const classification = exposureToClassification(likelihood, impact)

  const syncToRisk = (updates: Partial<Risk>) => {
    if (risk) onUpdate({ ...risk, ...updates })
  }

  const handleDescriptionBlur = () => syncToRisk({ description: description || undefined })
  const handleLikelihoodChange = (v: number) => {
    setLikelihood(v)
    syncToRisk({ likelihood: v })
  }
  const handleImpactChange = (v: number) => {
    setImpact(v)
    syncToRisk({ impact: v })
  }
  const handleStatusChange = (v: RiskStatus) => {
    setStatus(v)
    syncToRisk({ status: v })
  }
  const handleMitigationBlur = () =>
    syncToRisk({
      mitigationDescription: mitigationDescription || undefined,
      mitigationTargetDate: mitigationTargetDate || undefined,
      residualRiskRating: residualRiskRating || undefined,
      mitigationActions: mitigationActions.length ? mitigationActions : undefined,
    })
  const handleAcceptanceBlur = () =>
    syncToRisk({
      accepted: accepted,
      acceptanceRationale: acceptanceRationale || undefined,
      acceptedBy: acceptedBy || undefined,
    })

  const addAction = () => {
    const t = newActionText.trim()
    if (!t) return
    const next = [...mitigationActions, t]
    setMitigationActions(next)
    setNewActionText('')
    syncToRisk({ mitigationActions: next })
  }
  const removeAction = (idx: number) => {
    const next = mitigationActions.filter((_, i) => i !== idx)
    setMitigationActions(next)
    syncToRisk({ mitigationActions: next })
  }

  const handleOpenArtifact = (artifactKey: string) => {
    const route = ARTIFACT_ROUTES[artifactKey]
    if (route && projectId) {
      navigate(`/projects/${projectId}/${route}?from=risk-management`)
    } else {
      setIsPlannedFeatureOpen(true)
    }
  }

  const linkedArtifactKeys = [
    'Requirements',
    'Interfaces',
    'Issues',
    'Change Requests',
    'Verification Activities',
    'Configuration Baseline',
  ]

  if (!risk) return null

  return (
    <>
      <div
        className={clsx(
          'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden',
          isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
        )}
        role="region"
        aria-label="Risk details"
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{risk.id}</span>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as RiskStatus)}
                  className={clsx(
                    'px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-500 bg-transparent',
                    getStatusColor(status)
                  )}
                >
                  {RISK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{risk.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  onClick={() => {
                    onDelete(risk)
                    onClose()
                  }}
                  className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Delete risk"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {[
              { id: 'overview', title: 'Overview' },
              { id: 'assessment', title: 'Assessment' },
              { id: 'mitigation', title: 'Mitigation Plan' },
              { id: 'linked', title: 'Linked Artifacts' },
              { id: 'acceptance', title: 'Risk Acceptance' },
            ].map(({ id, title }) => (
              <div key={id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-white">{title}</span>
                  {expandedSections.has(id) ? (
                    <ChevronDown size={18} className="text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronRight size={18} className="text-gray-500 dark:text-gray-400" />
                  )}
                </button>
                {expandedSections.has(id) && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    {id === 'overview' && (
                      <>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Type</span>
                            <p className="font-medium text-gray-900 dark:text-white">{risk.type}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Owner</span>
                            <p className="font-medium text-gray-900 dark:text-white">{risk.owner}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Affected Area</span>
                            <p className="font-medium text-gray-900 dark:text-white">{risk.affectedArea}</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Description
                          </label>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            onBlur={handleDescriptionBlur}
                            rows={4}
                            placeholder="Enter description..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                      </>
                    )}
                    {id === 'assessment' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Likelihood (1–5)
                            </label>
                            <select
                              value={likelihood}
                              onChange={(e) => handleLikelihoodChange(Number(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Impact (1–5)
                            </label>
                            <select
                              value={impact}
                              onChange={(e) => handleImpactChange(Number(e.target.value))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Exposure</span>
                            <p className="font-medium text-gray-900 dark:text-white">{exposure} (L×I)</p>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">Classification</span>
                            <span
                              className={clsx(
                                'inline-block px-2 py-1 rounded-full text-xs font-medium',
                                getClassificationColor(classification)
                              )}
                            >
                              {classification}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {id === 'mitigation' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Mitigation description
                          </label>
                          <textarea
                            value={mitigationDescription}
                            onChange={(e) => setMitigationDescription(e.target.value)}
                            onBlur={handleMitigationBlur}
                            rows={3}
                            placeholder="Describe mitigation approach..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Actions (local only)
                          </label>
                          <div className="space-y-2">
                            {mitigationActions.map((action, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 py-1 px-2 bg-gray-50 dark:bg-gray-800 rounded"
                              >
                                <span className="flex-1 text-sm text-gray-900 dark:text-white">{action}</span>
                                <button
                                  type="button"
                                  onClick={() => removeAction(idx)}
                                  className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                                  aria-label="Remove action"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newActionText}
                                onChange={(e) => setNewActionText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAction())}
                                placeholder="New action..."
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              />
                              <button
                                type="button"
                                onClick={addAction}
                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
                              >
                                <Plus size={16} />
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Target completion date
                            </label>
                            <input
                              type="date"
                              value={mitigationTargetDate}
                              onChange={(e) => setMitigationTargetDate(e.target.value)}
                              onBlur={handleMitigationBlur}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              Residual risk rating
                            </label>
                            <input
                              type="text"
                              value={residualRiskRating}
                              onChange={(e) => setResidualRiskRating(e.target.value)}
                              onBlur={handleMitigationBlur}
                              placeholder="e.g. Low"
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {id === 'linked' && (
                      <div className="space-y-2">
                        {linkedArtifactKeys.map((key) => {
                          const Icon = ARTIFACT_ICONS[key]
                          const count = risk.linkedCounts?.[key] ?? MOCK_ARTIFACT_COUNTS[key] ?? 0
                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                {Icon && <Icon size={16} className="text-gray-500 dark:text-gray-400" />}
                                <span className="text-sm text-gray-900 dark:text-white">{key}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">({count})</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenArtifact(key)}
                                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                              >
                                Open
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {id === 'acceptance' && (
                      <div className="space-y-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Informational only. This is not an approval workflow.
                        </p>
                        <div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={accepted}
                              onChange={(e) => {
                                setAccepted(e.target.checked)
                                syncToRisk({ accepted: e.target.checked })
                              }}
                              onBlur={handleAcceptanceBlur}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                            />
                            <span className="text-sm text-gray-900 dark:text-white">Accepted</span>
                          </label>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Acceptance rationale
                          </label>
                          <textarea
                            value={acceptanceRationale}
                            onChange={(e) => setAcceptanceRationale(e.target.value)}
                            onBlur={handleAcceptanceBlur}
                            rows={2}
                            placeholder="Rationale for acceptance..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Accepted by
                          </label>
                          <input
                            type="text"
                            value={acceptedBy}
                            onChange={(e) => setAcceptedBy(e.target.value)}
                            onBlur={handleAcceptanceBlur}
                            placeholder="Name or role"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <PlannedFeatureModal isOpen={isPlannedFeatureOpen} onClose={() => setIsPlannedFeatureOpen(false)} />
    </>
  )
}
