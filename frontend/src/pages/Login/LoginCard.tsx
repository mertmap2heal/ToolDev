import Logo from '../../components/Logo'

interface LoginCardProps {
  children: React.ReactNode
}

export default function LoginCard({ children }: LoginCardProps) {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-[18px] border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-900 shadow-xl p-10">
        <div className="flex flex-col items-center mb-6">
          <Logo size="xl" showText={false} />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white text-center">
          Sign in
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 text-center mb-8">
          Use your credentials to access the platform.
        </p>
        {children}
      </div>
    </div>
  )
}
