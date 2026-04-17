import { Outlet, useParams, useSearchParams } from 'react-router-dom'
import PBSSidebar from '../pbs/PBSSidebar'
import { useMemo } from 'react'
import { ComponentContext } from './projectComponentContext'

/**
 * ProjectLayout wraps all project-scoped routes.
 * It includes the PBS sidebar on the left and passes the current component context
 * to child routes.
 */
export default function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  
  const componentId = searchParams.get('component')

  const contextValue = useMemo(
    () => ({
      componentId,
      projectId: projectId || null,
    }),
    [componentId, projectId]
  )

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No project selected</p>
      </div>
    )
  }

  return (
    <ComponentContext.Provider value={contextValue}>
      <div className="flex h-full">
        {/* PBS Sidebar */}
        <PBSSidebar />
        
        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </ComponentContext.Provider>
  )
}
