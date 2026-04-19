import { Outlet } from 'react-router-dom'

import SafetyNavigation from '../../components/safety/SafetyNavigation'

export default function SafetyLayoutPage() {
  return (
    <div className="space-y-6">
      <SafetyNavigation />

      {/* #270: the Safety Analysis module (hazards, FTA, Markov, audit
          log) is entirely UI / in-memory. Persistence, real solvers, and
          the audit trail are not implemented. Render a persistent warning
          banner across every Safety sub-page so entries are not mistaken
          for certifiable evidence. */}
      <div
        role="alert"
        className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3"
      >
        <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
          Demo data only — nothing is saved
        </p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          Hazards, FTA nodes, Markov chains, and the audit log on these
          pages live in session state only and are lost on refresh.
          Results are not computed from real solvers. These views MUST
          NOT be used as safety evidence. Backend persistence and the
          Markov / FTA solvers are not yet implemented.
        </p>
      </div>

      <Outlet />
    </div>
  )
}
