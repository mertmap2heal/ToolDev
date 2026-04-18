import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import Logo from '../../components/Logo'

interface LegalLayoutProps {
  title: string
  lastUpdated: string
  children: React.ReactNode
}

export default function LegalLayout({ title, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <Logo size="sm" showText={false} />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Engineering Tool
            </span>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            <ArrowLeft size={16} />
            Back to login
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-[18px] border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-900 shadow-xl p-8 sm:p-10">
          <div
            role="alert"
            className="flex items-start gap-3 p-3 mb-6 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-l-yellow-500 text-yellow-800 dark:text-yellow-300 text-sm"
          >
            <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
            <span className="flex-1">
              <strong>Draft - pending legal review.</strong> This document is a pre-launch
              draft published so that product links function. It must be reviewed and
              approved by qualified legal counsel before any production deployment with
              real customer data.
            </span>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Last updated: {lastUpdated}
          </p>

          <div className="mt-6 space-y-6 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
