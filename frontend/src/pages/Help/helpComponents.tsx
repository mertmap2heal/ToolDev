import { Info, Lightbulb, AlertTriangle } from 'lucide-react'

/**
 * Shared building blocks for help-section components: callouts and
 * a Kbd renderer. Kept theme-token-driven so the help system stays
 * visually consistent with the rest of the app.
 */

export function Callout({
  variant,
  title,
  children,
}: {
  variant: 'note' | 'tip' | 'warning'
  title: string
  children: React.ReactNode
}) {
  const styles = {
    note: {
      Icon: Info,
      bar: 'border-l-blue-500',
      tint: 'bg-blue-50 dark:bg-blue-950/30',
      icon: 'text-blue-600 dark:text-blue-400',
    },
    tip: {
      Icon: Lightbulb,
      bar: 'border-l-emerald-500',
      tint: 'bg-emerald-50 dark:bg-emerald-950/30',
      icon: 'text-emerald-600 dark:text-emerald-400',
    },
    warning: {
      Icon: AlertTriangle,
      bar: 'border-l-amber-500',
      tint: 'bg-amber-50 dark:bg-amber-950/30',
      icon: 'text-amber-600 dark:text-amber-400',
    },
  }[variant]
  const { Icon } = styles
  return (
    <div className={`my-5 border-l-2 ${styles.bar} ${styles.tint} px-4 py-3 rounded-r-md not-prose`}>
      <div className="flex items-start gap-2">
        <Icon size={15} className={`mt-0.5 ${styles.icon} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{title}</p>
          <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 mx-0.5 text-[11px] font-mono font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
      {children}
    </kbd>
  )
}

export function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="not-prose mt-4 mb-5 rounded-lg bg-gray-900 dark:bg-gray-950 border border-gray-800 text-gray-100 text-[12.5px] leading-6 font-mono p-4 overflow-x-auto">
      {children}
    </pre>
  )
}
