import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Link2, FileText } from 'lucide-react'
import { MOCK_ANALYSES, MOCK_METHOD_METADATA } from '../../data/mockSafety'
import FhaForm from '../../components/safety/FhaForm'
import PssaForm from '../../components/safety/PssaForm'
import SsaForm from '../../components/safety/SsaForm'
import FmeaForm from '../../components/safety/FmeaForm'
import CcaForm from '../../components/safety/CcaForm'
import type { SafetyMethod } from '../../types/safety.types'

const STEPS = [
  { id: 1, label: 'Baseline', icon: null },
  { id: 2, label: 'Basic info', icon: FileText },
  { id: 3, label: 'Link Hazards', icon: Link2 },
  { id: 4, label: 'Link Reqs / Functions / Interfaces / Params', icon: null },
  { id: 5, label: 'Method-specific inputs', icon: null },
  { id: 6, label: 'Summary', icon: null },
]

const METHOD_IDS = ['FHA', 'PSSA', 'SSA', 'FMEA', 'FTA', 'CCA', 'Markov'] as const

export default function EditAnalysisWizardPage() {
  const { projectId, method, id } = useParams<{ projectId: string; method: string; id: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [baseline, setBaseline] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [linkHazardsModal, setLinkHazardsModal] = useState(false)
  const [linkReqsModal, setLinkReqsModal] = useState(false)
  const [linkedHazardsCount, setLinkedHazardsCount] = useState(0)
  const [linkedReqsCount, setLinkedReqsCount] = useState(0)
  const [linkedFnCount, setLinkedFnCount] = useState(0)
  const [linkedIfaceCount, setLinkedIfaceCount] = useState(0)
  const [linkedParamCount, setLinkedParamCount] = useState(0)

  const methodKey = (method ?? '').toUpperCase()
  const isValidMethod = METHOD_IDS.includes(methodKey as SafetyMethod)
  const meta = MOCK_METHOD_METADATA.find((m) => m.id === methodKey)

  const analysis = isValidMethod && id
    ? (MOCK_ANALYSES[methodKey] ?? []).find((a) => a.id === id)
    : null

  useEffect(() => {
    if (analysis) {
      setTitle(analysis.title)
      setDescription(analysis.description ?? '')
      setLinkedHazardsCount(analysis.linkedHazardsCount)
    }
  }, [analysis])

  const canNext = () => {
    if (step === 1) return true
    if (step === 2) return !!title.trim()
    return true
  }

  const handleNext = () => {
    if (step < 6 && canNext()) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSaveDraft = () => {
    alert('Save Draft will be implemented later. UI only.')
  }

  const handleSubmitReview = () => {
    alert('Submit for Review will be implemented later. UI only.')
  }

  const handleCancel = () => {
    if (projectId && method) {
      navigate(`/projects/${projectId}/safety-analysis/analyses/${method}`)
    }
  }

  if (!isValidMethod) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Unknown method</h2>
        <p className="text-gray-600 dark:text-gray-400">Invalid method: {method}</p>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analysis not found</h2>
        <p className="text-gray-600 dark:text-gray-400">ID: {id}</p>
        <button
          onClick={() => projectId && method && navigate(`/projects/${projectId}/safety-analysis/analyses/${method}`)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
        >
          Back to list
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit {meta?.name ?? methodKey} — {analysis.title}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Step {step} of 6 — {STEPS[step - 1]?.label}
          </p>
        </div>
        <button
          onClick={handleCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
        >
          Cancel
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${
              s.id === step
                ? 'bg-blue-600 text-white'
                : s.id < step
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}
          >
            {s.id}. {s.label}
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 min-h-[320px]">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Select Baseline</h3>
            <select
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">— Select baseline (placeholder) —</option>
              <option value="bl1">BL-001</option>
              <option value="bl2">BL-002</option>
            </select>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Basic info</h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Analysis title"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Link Hazards</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Placeholder. Linked: {linkedHazardsCount}</p>
            <button
              onClick={() => setLinkHazardsModal(true)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium"
            >
              Link Hazards
            </button>
            {linkHazardsModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Link Hazards (placeholder)</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">UI stub.</p>
                  <button
                    onClick={() => setLinkHazardsModal(false)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Link Requirements / Functions / Interfaces / Parameters
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Modal placeholders.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setLinkReqsModal(true)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm">
                Link Requirements
              </button>
              <button onClick={() => alert('Link Functions placeholder.')} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm">
                Link Functions
              </button>
              <button onClick={() => alert('Link Interfaces placeholder.')} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm">
                Link Interfaces
              </button>
              <button onClick={() => alert('Link Parameters placeholder.')} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm">
                Link Parameters
              </button>
            </div>
            {linkReqsModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Link Requirements (placeholder)</h4>
                  <button onClick={() => { setLinkReqsModal(false); setLinkedReqsCount(3); }} className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Close</button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Method-specific inputs ({methodKey})</h3>
            {methodKey === 'FHA' && <FhaForm />}
            {methodKey === 'PSSA' && <PssaForm />}
            {methodKey === 'SSA' && <SsaForm />}
            {methodKey === 'FMEA' && <FmeaForm />}
            {methodKey === 'CCA' && <CcaForm />}
            {(methodKey === 'FTA' || methodKey === 'MARKOV') && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                FTA uses Visual Analysis page. Markov uses the dedicated Markov page.
              </p>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Title</div>
              <div className="text-gray-700 dark:text-gray-300">{title || '—'}</div>
              <div>Linked Hazards</div>
              <div className="text-gray-700 dark:text-gray-300">{linkedHazardsCount}</div>
              <div>Linked Requirements</div>
              <div className="text-gray-700 dark:text-gray-300">{linkedReqsCount}</div>
              <div>Linked Functions</div>
              <div className="text-gray-700 dark:text-gray-300">{linkedFnCount}</div>
              <div>Linked Interfaces</div>
              <div className="text-gray-700 dark:text-gray-300">{linkedIfaceCount}</div>
              <div>Linked Parameters</div>
              <div className="text-gray-700 dark:text-gray-300">{linkedParamCount}</div>
            </div>
            <span className="inline-block mt-4 px-2 py-1 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400">
              Traceability completeness (static)
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={handleBack} disabled={step === 1} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex gap-2">
          {step === 6 ? (
            <>
              <button onClick={handleSaveDraft} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium">Save Draft</button>
              <button onClick={handleSubmitReview} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Submit for Review</button>
            </>
          ) : (
            <button onClick={handleNext} disabled={!canNext()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
