import { Outlet, useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  BarChart3,
  FileText,
  CheckCircle,
  Settings,
  FileCode,
  Play,
} from 'lucide-react'

import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'
import { VerificationDrawerProvider, useVerificationDrawer } from '../../contexts/VerificationDrawerContext'
import TestPlanDetailDrawer from '../../components/verification/TestPlanDetailDrawer'
import TestCaseDetailDrawer from '../../components/verification/TestCaseDetailDrawer'
import TestSetupDetailDrawer from '../../components/verification/TestSetupDetailDrawer'
import TestResultDetailDrawer from '../../components/verification/TestResultDetailDrawer'
import clsx from 'clsx'

const MAIN_TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'plans', label: 'Test Plans', icon: FileText },
  { id: 'cases', label: 'Test Cases', icon: CheckCircle },
  { id: 'runs', label: 'Test Runs', icon: Play },
  { id: 'setups', label: 'Test Setups', icon: Settings },
  { id: 'results', label: 'Test Results', icon: CheckCircle },
]

function VerificationLayoutInner() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isTemplates = location.pathname.includes('/verification/templates')
  const tabParam = new URLSearchParams(location.search).get('tab') || 'overview'
  const drawer = useVerificationDrawer()

  const handleMainTab = (tabId: string) => {
    navigate(`/projects/${projectId}/verification?tab=${tabId}`, { replace: true })
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left column: nav, title, tabs, content — same as Requirements */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden pr-6 gap-6">
        <div className="flex-shrink-0">

        </div>
        <div className="flex-shrink-0 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verification</h2>
          {projectId && <SafetyLinkPanel variant="evidence" count={2} />}
        </div>

        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {MAIN_TABS.map((tab) => {
              const Icon = tab.icon
              const active = !isTemplates && tabParam === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleMainTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              )
            })}
            <Link
              to={`/projects/${projectId}/verification/templates`}
              className={clsx(
                'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                isTemplates
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <FileCode size={16} />
              Templates
            </Link>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Outlet />
        </div>
      </div>

      {/* Drawers - sibling of left column, full height from top (like Requirements) */}
      {projectId && (
        <>
          <TestPlanDetailDrawer
            plan={drawer.selectedPlan}
            isOpen={drawer.isPlanDrawerOpen}
            onClose={drawer.closePlan}
            projectId={projectId}
          />
          <TestCaseDetailDrawer
            testCase={drawer.selectedCase}
            isOpen={drawer.isCaseDrawerOpen}
            onClose={drawer.closeCase}
            projectId={projectId}
          />
          <TestSetupDetailDrawer
            setup={drawer.selectedSetup}
            isOpen={drawer.isSetupDrawerOpen}
            onClose={drawer.closeSetup}
            projectId={projectId}
          />
          <TestResultDetailDrawer
            testResult={drawer.selectedResult}
            isOpen={drawer.isResultDrawerOpen}
            onClose={drawer.closeResult}
            projectId={projectId}
          />
        </>
      )}
    </div>
  )
}

export default function VerificationLayoutPage() {
  return (
    <VerificationDrawerProvider>
      <VerificationLayoutInner />
    </VerificationDrawerProvider>
  )
}
