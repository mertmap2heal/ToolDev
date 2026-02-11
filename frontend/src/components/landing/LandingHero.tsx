import { useNavigate } from 'react-router-dom'
import { authService } from '../../services/auth.service'

export default function LandingHero() {
  const navigate = useNavigate()
  const token = authService.getToken()

  const handlePrimaryCta = () => {
    if (token) navigate('/')
    else navigate('/login')
  }

  const handleSecondaryCta = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">
              Enterprise engineering lifecycle management
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-xl">
              Requirements, traceability, verification, and compliance—all in one place. Built for teams that demand rigor and audit readiness.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {token ? 'Open App' : 'Login'}
              </button>
              <button
                type="button"
                onClick={handleSecondaryCta}
                className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Explore Features
              </button>
            </div>
          </div>
          <div className="hidden lg:block flex justify-center">
            {/* SVG placeholder - gradient card mock */}
            <div
              className="w-full max-w-md aspect-video rounded-xl bg-gradient-to-br from-blue-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden"
              aria-hidden
            >
              <svg
                viewBox="0 0 400 240"
                className="w-full h-full"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="400" height="240" fill="url(#heroGrad)" />
                <defs>
                  <linearGradient id="heroGrad" x1="0" y1="0" x2="400" y2="240" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#EFF6FF" stopOpacity="0.5" />
                    <stop offset="1" stopColor="#F3F4F6" stopOpacity="0.5" />
                  </linearGradient>
                </defs>
                <rect x="40" y="40" width="120" height="80" rx="4" fill="white" fillOpacity="0.9" stroke="#3B82F6" strokeWidth="1" />
                <rect x="40" y="130" width="80" height="20" rx="2" fill="#3B82F6" fillOpacity="0.3" />
                <rect x="180" y="40" width="140" height="100" rx="4" fill="white" fillOpacity="0.9" stroke="#3B82F6" strokeWidth="1" />
                <line x1="190" y1="55" x2="300" y2="55" stroke="#9CA3AF" strokeWidth="1" />
                <line x1="190" y1="70" x2="280" y2="70" stroke="#9CA3AF" strokeWidth="1" />
                <line x1="190" y1="85" x2="260" y2="85" stroke="#9CA3AF" strokeWidth="1" />
                <circle cx="220" cy="165" r="12" fill="#3B82F6" fillOpacity="0.5" />
                <circle cx="260" cy="165" r="12" fill="#3B82F6" fillOpacity="0.3" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
