export default function LandingFooter() {
  return (
    <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400">
          <div>
            <span>© 2026 Company Name</span>
            <span className="mx-2">·</span>
            <span>v1.0</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="mailto:contact@company.com"
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              contact@company.com
            </a>
            <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
