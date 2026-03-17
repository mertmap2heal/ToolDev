import { useCertificationStore } from './store'
import type { Authority, CertBasis, StandardId } from './types'
import { updateCertificationContext } from '../../services/certification.service'

const AUTHORITIES: Authority[] = ['EASA', 'FAA', 'Military', 'Customer']
const CERT_BASES: CertBasis[] = ['CS-25', 'CS-23', 'SC-VTOL', 'MIL-STD', 'Custom']
const STANDARDS_OPTIONS: StandardId[] = ['ARP4754A', 'DO-178C', 'DO-254', 'EN9100', 'ISO9001']

export default function ContextSelectorCard() {
  const { state, dispatch, refetch } = useCertificationStore()
  const { context, baselines, releases } = state
  const { projectId, authority, certBasis, standards, selectedBaseline, selectedRelease } = context

  const hasSelection = selectedBaseline !== null || selectedRelease !== null

  const persistContext = async (patch: Parameters<typeof updateCertificationContext>[1]) => {
    if (!projectId || !refetch) return
    const res = await updateCertificationContext(projectId, patch)
    if (res.success) await refetch()
  }

  const toggleStandard = (id: StandardId) => {
    const next = standards.includes(id) ? standards.filter((s) => s !== id) : [...standards, id]
    dispatch({ type: 'SET_STANDARDS', payload: next })
    persistContext({ standards: next })
  }

  return (
    <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Certification context
      </h3>

      {!hasSelection && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
          Select baseline or release to view certification readiness.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Authority
          </label>
          <select
            value={authority}
            onChange={(e) => {
              const v = e.target.value as Authority
              dispatch({ type: 'SET_AUTHORITY', payload: v })
              persistContext({ authority: v })
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            {AUTHORITIES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Certification basis
          </label>
          <select
            value={certBasis}
            onChange={(e) => {
              const v = e.target.value as CertBasis
              dispatch({ type: 'SET_CERT_BASIS', payload: v })
              persistContext({ certBasis: v })
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            {CERT_BASES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Baseline
          </label>
          <select
            value={selectedBaseline?.baselineId ?? ''}
            onChange={(e) => {
              const id = e.target.value
              const bl = id ? baselines.find((b) => b.baselineId === id) ?? null : null
              dispatch({ type: 'SET_BASELINE', payload: bl })
              persistContext({
                selectedBaselineId: bl?.baselineId ?? null,
                selectedReleaseId: selectedRelease?.releaseId ?? null,
              })
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="">— Select —</option>
            {baselines.map((b) => (
              <option key={b.baselineId} value={b.baselineId}>
                {b.name}
              </option>
            ))}
          </select>
          {selectedBaseline && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {selectedBaseline.status}
            </span>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Release
          </label>
          <select
            value={selectedRelease?.releaseId ?? ''}
            onChange={(e) => {
              const id = e.target.value
              const rel = id ? releases.find((r) => r.releaseId === id) ?? null : null
              dispatch({ type: 'SET_RELEASE', payload: rel })
              persistContext({
                selectedBaselineId: selectedBaseline?.baselineId ?? null,
                selectedReleaseId: rel?.releaseId ?? null,
              })
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          >
            <option value="">— Select —</option>
            {releases.map((r) => (
              <option key={r.releaseId} value={r.releaseId}>
                {r.name}
              </option>
            ))}
          </select>
          {selectedRelease && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {selectedRelease.status}
            </span>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Standards
          </label>
          <div className="flex flex-wrap gap-2">
            {STANDARDS_OPTIONS.map((s) => (
              <label
                key={s}
                className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  checked={standards.includes(s)}
                  onChange={() => toggleStandard(s)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
