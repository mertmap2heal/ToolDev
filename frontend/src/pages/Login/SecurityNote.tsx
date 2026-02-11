import { Lock } from 'lucide-react'

export default function SecurityNote() {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
      <Lock size={16} className="shrink-0" aria-hidden />
      <span>Secured with enterprise-grade encryption</span>
    </div>
  )
}
