import { useState } from 'react'

const OPERATIONAL_PHASES = ['taxi', 'takeoff', 'climb', 'cruise', 'descent', 'landing']
const SEVERITY_OPTIONS = ['Catastrophic', 'Hazardous', 'Major', 'Minor', 'No Safety Effect']

export default function FhaForm() {
  const [phase, setPhase] = useState('')
  const [functionRef, setFunctionRef] = useState('')
  const [failureCondition, setFailureCondition] = useState('')
  const [effects, setEffects] = useState('')
  const [severity, setSeverity] = useState('')
  const [mitigations, setMitigations] = useState('')
  const [linkedHazard, setLinkedHazard] = useState('')
  const [recommendedDal, setRecommendedDal] = useState('DAL A (placeholder)')

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">FHA — Functional Hazard Assessment</h4>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Operational Phase</label>
        <select
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">— Select —</option>
          {OPERATIONAL_PHASES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Function under analysis (link to Functions)</label>
        <input
          type="text"
          value={functionRef}
          onChange={(e) => setFunctionRef(e.target.value)}
          placeholder="Placeholder link to Functions"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Failure condition</label>
        <textarea
          value={failureCondition}
          onChange={(e) => setFailureCondition(e.target.value)}
          placeholder="Describe failure condition"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Effects</label>
        <textarea
          value={effects}
          onChange={(e) => setEffects(e.target.value)}
          placeholder="Effects"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Severity classification</label>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="w-full max-w-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        >
          <option value="">— Select —</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Suggested mitigations</label>
        <textarea
          value={mitigations}
          onChange={(e) => setMitigations(e.target.value)}
          placeholder="Mitigations"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
        />
      </div>
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Outputs (display only)</h5>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-gray-500 dark:text-gray-400 mb-1">Linked hazard</label>
            <input
              type="text"
              value={linkedHazard}
              onChange={(e) => setLinkedHazard(e.target.value)}
              placeholder="Placeholder"
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-gray-500 dark:text-gray-400 mb-1">Recommended DAL</label>
            <div className="px-2 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-700 dark:text-gray-300">
              {recommendedDal}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
