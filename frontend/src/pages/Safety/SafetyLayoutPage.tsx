import { Outlet } from 'react-router-dom'

import SafetyNavigation from '../../components/safety/SafetyNavigation'

export default function SafetyLayoutPage() {
  return (
    <div className="space-y-6">

      <SafetyNavigation />
      <Outlet />
    </div>
  )
}
