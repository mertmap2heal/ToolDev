import { Outlet } from 'react-router-dom'


/**
 * Layout for the Product Breakdown Structure section.
 * Renders project nav and then the PBS content (sidebar + main via ProjectLayout).
 */
export default function PBSLayoutPage() {
  return (
    <div className="space-y-6">

      <Outlet />
    </div>
  )
}
