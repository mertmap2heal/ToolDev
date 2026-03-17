import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from '../Logo'
import { authService } from '../../services/auth.service'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Modules', href: '#modules' },
  { label: 'Security', href: '#security' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

function scrollToSection(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  e.preventDefault()
  const id = href.slice(1)
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth' })
}

export default function LandingNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const navigate = useNavigate()
  const token = authService.getToken()

  const handleCtaClick = useCallback(() => {
    if (token) {
      navigate('/')
    } else {
      navigate('/login')
    }
    setIsMenuOpen(false)
  }, [token, navigate])

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      scrollToSection(e, href)
      setIsMenuOpen(false)
    },
    []
  )

  return (
    <nav
      className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault()
              navigate('/')
            }}
            className="flex items-center shrink-0"
            aria-label="Engineering Tool home"
          >
            <Logo size="md" />
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                onClick={(e) => scrollToSection(e, href)}
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleCtaClick}
              className="hidden md:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {token ? 'Open App' : 'Login'}
            </button>

            {/* Hamburger */}
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div
          className={isMenuOpen ? 'md:hidden border-t border-gray-200 dark:border-gray-700' : 'hidden'}
          role="region"
          aria-label="Mobile menu"
        >
          <div className="py-4 flex flex-col gap-2">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                onClick={(e) => handleNavClick(e, href)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
              >
                {label}
              </a>
            ))}
            <button
              type="button"
              onClick={handleCtaClick}
              className="mx-4 mt-2 py-2.5 px-4 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {token ? 'Open App' : 'Login'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
