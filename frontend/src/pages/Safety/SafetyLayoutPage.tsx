import { Outlet } from 'react-router-dom'

import SafetyNavigation from '../../components/safety/SafetyNavigation'

export default function SafetyLayoutPage() {
  return (
    <div className="space-y-6">
      <SafetyNavigation />

      {/* NX-9 (#466): the Hazard log and the FMEA worksheet are now
          backed by real persistence. The rest of the module (fault
          trees, Markov models, the audit trail) is still preview-scope,
          so a calm Beta status strip stays across every Safety sub-page. */}
      <div className="rounded-md border border-default bg-status-info/10 px-4 py-3">
        <p className="text-xs text-ink-primary">
          Safety Analysis is in Beta. Hazards and FMEA worksheets are saved. Fault trees,
          Markov models, and the audit trail are not yet wired — do not cite them as
          evidence.
        </p>
      </div>

      <Outlet />
    </div>
  )
}
