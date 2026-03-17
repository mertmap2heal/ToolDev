import { useState, useMemo } from 'react'
import { GitCompare, Package } from 'lucide-react'
import { useCMStore } from './store'
type CompareMode = 'baseline-vs-baseline' | 'ci-vs-ci'

interface DiffRow {
  ciId: string
  change: 'added' | 'removed' | 'version-change'
  versionA?: string
  revisionA?: string
  versionB?: string
  revisionB?: string
}

export default function CompareTab() {
  const { state } = useCMStore()
  const [mode, setMode] = useState<CompareMode>('baseline-vs-baseline')
  const [baselineAId, setBaselineAId] = useState('')
  const [baselineBId, setBaselineBId] = useState('')
  const [ciId, setCiId] = useState('')
  const [versionA, setVersionA] = useState('')
  const [versionB, setVersionB] = useState('')

  const baselines = state.baselines
  const baselineA = baselines.find((b) => b.baselineId === baselineAId)
  const baselineB = baselines.find((b) => b.baselineId === baselineBId)

  const baselineDiff = useMemo((): DiffRow[] => {
    if (!baselineA || !baselineB) return []
    const mapA = new Map(baselineA.ciSnapshot.map((s) => [s.ciId, s]))
    const mapB = new Map(baselineB.ciSnapshot.map((s) => [s.ciId, s]))
    const allIds = new Set([...mapA.keys(), ...mapB.keys()])
    const rows: DiffRow[] = []
    allIds.forEach((id) => {
      const a = mapA.get(id)
      const b = mapB.get(id)
      if (!a && b) rows.push({ ciId: id, change: 'added', versionB: b.version, revisionB: b.revision })
      else if (a && !b) rows.push({ ciId: id, change: 'removed', versionA: a.version, revisionA: a.revision })
      else if (a && b && (a.version !== b.version || a.revision !== b.revision))
        rows.push({
          ciId: id,
          change: 'version-change',
          versionA: a.version,
          revisionA: a.revision,
          versionB: b.version,
          revisionB: b.revision,
        })
    })
    return rows
  }, [baselineA, baselineB])

  const ci = state.configurationItems.find((c) => c.ciId === ciId)
  const ciVersionHistory = useMemo(() => {
    if (!ci) return []
    return [
      { version: ci.version, revision: ci.revision, label: 'Current' },
      { version: '2.0.0', revision: 'Rev B', label: 'Previous' },
      { version: '1.0.0', revision: 'Rev A', label: 'Initial' },
    ]
  }, [ci])

  const ciDiffRows = useMemo(() => {
    if (!versionA || !versionB || versionA === versionB) return []
    const vA = ciVersionHistory.find((v) => v.version === versionA)
    const vB = ciVersionHistory.find((v) => v.version === versionB)
    if (!vA || !vB) return []
    return [
      { field: 'Version', valueA: vA.version, valueB: vB.version },
      { field: 'Revision', valueA: vA.revision, valueB: vB.revision },
    ]
  }, [versionA, versionB, ciVersionHistory])

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex gap-4 mb-4">
          <button
            type="button"
            onClick={() => setMode('baseline-vs-baseline')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              mode === 'baseline-vs-baseline'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <GitCompare size={16} />
            Baseline vs baseline
          </button>
          <button
            type="button"
            onClick={() => setMode('ci-vs-ci')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              mode === 'ci-vs-ci'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <Package size={16} />
            CI vs CI (versions)
          </button>
        </div>

        {mode === 'baseline-vs-baseline' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Baseline A
              </label>
              <select
                value={baselineAId}
                onChange={(e) => setBaselineAId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select baseline</option>
                {baselines.map((b) => (
                  <option key={b.baselineId} value={b.baselineId}>
                    {b.baselineId} — {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Baseline B
              </label>
              <select
                value={baselineBId}
                onChange={(e) => setBaselineBId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select baseline</option>
                {baselines.map((b) => (
                  <option key={b.baselineId} value={b.baselineId}>
                    {b.baselineId} — {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {mode === 'ci-vs-ci' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Configuration Item
              </label>
              <select
                value={ciId}
                onChange={(e) => {
                  setCiId(e.target.value)
                  setVersionA('')
                  setVersionB('')
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select CI</option>
                {state.configurationItems.map((c) => (
                  <option key={c.ciId} value={c.ciId}>
                    {c.ciId} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Version A
              </label>
              <select
                value={versionA}
                onChange={(e) => setVersionA(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select</option>
                {ciVersionHistory.map((v) => (
                  <option key={v.version} value={v.version}>
                    {v.version} ({v.revision})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Version B
              </label>
              <select
                value={versionB}
                onChange={(e) => setVersionB(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select</option>
                {ciVersionHistory.map((v) => (
                  <option key={v.version} value={v.version}>
                    {v.version} ({v.revision})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {mode === 'baseline-vs-baseline' && baselineA && baselineB && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Differences: {baselineAId} vs {baselineBId}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    CI ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Change
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Version A
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Revision A
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Version B
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Revision B
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {baselineDiff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No differences (same snapshot).
                    </td>
                  </tr>
                ) : (
                  baselineDiff.map((row) => (
                    <tr key={row.ciId} className="text-gray-700 dark:text-gray-300">
                      <td className="px-4 py-2 font-mono">{row.ciId}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            row.change === 'added'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : row.change === 'removed'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}
                        >
                          {row.change === 'added'
                            ? 'Added'
                            : row.change === 'removed'
                              ? 'Removed'
                              : 'Version change'}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono">{row.versionA ?? '—'}</td>
                      <td className="px-4 py-2 font-mono">{row.revisionA ?? '—'}</td>
                      <td className="px-4 py-2 font-mono">{row.versionB ?? '—'}</td>
                      <td className="px-4 py-2 font-mono">{row.revisionB ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === 'ci-vs-ci' && ciId && versionA && versionB && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Metadata diff: {ciId} — {versionA} vs {versionB}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Field
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Version A
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Version B
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {ciDiffRows.map((row) => (
                  <tr key={row.field} className="text-gray-700 dark:text-gray-300">
                    <td className="px-4 py-2 font-medium">{row.field}</td>
                    <td className="px-4 py-2 font-mono">{row.valueA}</td>
                    <td className="px-4 py-2 font-mono">{row.valueB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
