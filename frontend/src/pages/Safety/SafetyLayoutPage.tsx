import { Outlet } from 'react-router-dom'
import ProjectNavigation from '../../components/projects/ProjectNavigation'
import SafetyNavigation from '../../components/safety/SafetyNavigation'

export default function SafetyLayoutPage() {
  return (
    <div className="space-y-6">
      <ProjectNavigation />
      <SafetyNavigation />
      <Outlet />
    </div>
  )
}
