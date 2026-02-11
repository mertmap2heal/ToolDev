import Logo from '../../components/Logo'

const BULLETS = [
  'Requirements & Traceability',
  'Risk & Change Control',
  'Verification & Validation',
]

interface AuthLayoutProps {
  children: React.ReactNode
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-[2fr_3fr]">
      {/* Left panel - hidden on mobile */}
      <div className="hidden lg:flex flex-col justify-center px-12 py-16 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Logo size="xl" showText={false} />
        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
          Engineering Tool
        </h1>
        <p className="mt-1 text-lg font-medium text-gray-600 dark:text-gray-400">
          Engineering Management Platform
        </p>
        <ul className="mt-8 space-y-3">
          {BULLETS.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Right panel - login area */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 lg:px-12 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
        {children}
      </div>
    </div>
  )
}
