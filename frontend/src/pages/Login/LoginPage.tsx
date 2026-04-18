import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, AlertCircle, X } from 'lucide-react'
import AuthLayout from './AuthLayout'
import LoginCard from './LoginCard'
import SecurityNote from './SecurityNote'
import CapsLockWarning from './CapsLockWarning'
import { authService } from '../../services/auth.service'
import { useAuthStore } from '../../store/authStore'

const MIN_USERNAME_LENGTH = 1
const MIN_PASSWORD_LENGTH = 6

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false)
  const [forgotPasswordLogin, setForgotPasswordLogin] = useState('')
  const [forgotPasswordSubmitting, setForgotPasswordSubmitting] = useState(false)
  const [forgotPasswordSuccessMessage, setForgotPasswordSuccessMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const errorRef = useRef<HTMLDivElement>(null)
  const usernameInputRef = useRef<HTMLInputElement>(null)

  const token = authService.getToken()

  useEffect(() => {
    if (token) {
      navigate('/', { replace: true })
    }
  }, [navigate, token])

  const getUserFriendlyError = (responseError?: string, statusCode?: number): string => {
    if (statusCode === 401) return 'Invalid email/username or password.'
    const err = (responseError ?? '').toLowerCase()
    if (err.includes('connect') || err.includes('network') || err.includes('backend')) {
      return 'Backend not reachable. Start it in a terminal: cd backend && npm run dev — then try again.'
    }
    return responseError || 'Something went wrong. Please try again.'
  }

  const validate = (): boolean => {
    const trimmedUsername = username.trim()
    const errors: { username?: string; password?: string } = {}
    if (!trimmedUsername) {
      errors.username = 'Email or username is required.'
    } else if (trimmedUsername.length < MIN_USERNAME_LENGTH) {
      errors.username = `Must be at least ${MIN_USERNAME_LENGTH} character.`
    }
    if (!password) {
      errors.password = 'Password is required.'
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    if (!validate()) {
      usernameInputRef.current?.focus()
      return
    }

    setIsLoading(true)

    try {
      const response = await authService.login(
        { email: username.trim(), password },
        rememberMe
      )

      if (response.success && response.data) {
        setUser(response.data.user)
        if (response.data.user.role === 'SUPERIOR_ADMIN' || response.data.user.isSuperiorAdmin) {
          navigate('/platform-admin', { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      } else {
        const res = response as { error?: string; statusCode?: number }
        const message = getUserFriendlyError(res.error, res.statusCode)
        setError(message)
        errorRef.current?.focus()
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Login failed.'
      setError(getUserFriendlyError(msg))
      errorRef.current?.focus()
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPasswordClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setForgotPasswordSuccessMessage(null)
    setForgotPasswordLogin(username.trim())
    setShowForgotPasswordModal(true)
  }

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = forgotPasswordLogin.trim()
    if (!value) return
    setForgotPasswordSubmitting(true)
    try {
      const res = await authService.requestPasswordReset(value)
      if (res.success && res.data?.message) {
        setForgotPasswordSuccessMessage(res.data.message)
      } else {
        setForgotPasswordSuccessMessage(
          'If an account exists for that login, you will receive an email with a temporary password. Use it to log in, then set a new password.'
        )
      }
    } catch {
      setForgotPasswordSuccessMessage(
        'If an account exists for that login, you will receive an email with a temporary password. Use it to log in, then set a new password.'
      )
    } finally {
      setForgotPasswordSubmitting(false)
    }
  }

  const closeForgotPasswordModal = () => {
    setShowForgotPasswordModal(false)
    setForgotPasswordLogin('')
    setForgotPasswordSuccessMessage(null)
  }

  if (token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
        <div className="flex flex-col items-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 size={24} className="animate-spin" />
          <span>Redirecting...</span>
        </div>
      </div>
    )
  }

  const usernameError = fieldErrors.username
  const passwordError = fieldErrors.password

  return (
    <AuthLayout>
      <LoginCard>
        <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset disabled={isLoading} className="space-y-5 border-none p-0 m-0 min-w-0">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Email or username
              </label>
              <input
                ref={usernameInputRef}
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (fieldErrors.username) setFieldErrors((prev) => ({ ...prev, username: undefined }))
                }}
                autoComplete="username"
                required
                aria-invalid={!!usernameError}
                aria-describedby={usernameError ? 'username-error' : undefined}
                disabled={isLoading}
                className={`w-full px-4 py-2.5 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 ${
                  usernameError
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Enter your email or username"
              />
              {usernameError && (
                <p id="username-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {usernameError}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }))
                  }}
                  onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                  onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                  autoComplete="current-password"
                  required
                  aria-invalid={!!passwordError}
                  aria-describedby={[passwordError && 'password-error', capsLockOn && 'capslock-warning'].filter(Boolean).join(' ') || undefined}
                  disabled={isLoading}
                  className={`w-full px-4 py-2.5 pr-10 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 ${
                    passwordError
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-expanded={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && (
                <p id="password-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {passwordError}
                </p>
              )}
              <CapsLockWarning show={capsLockOn} />
              <div className="mt-1.5 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={handleForgotPasswordClick}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            </fieldset>

            {error && (
              <div
                ref={errorRef}
                role="alert"
                aria-live="assertive"
                tabIndex={-1}
                className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500 text-red-700 dark:text-red-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError('')}
                  className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label="Dismiss error"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              aria-busy={isLoading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>

            <SecurityNote />

            <div className="pt-4 flex justify-center gap-4 text-sm">
              <Link
                to="/privacy"
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Terms of Use
              </Link>
            </div>
          </form>
      </LoginCard>

      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md p-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Reset password
            </h2>
            {forgotPasswordSuccessMessage ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {forgotPasswordSuccessMessage}
                </p>
                <button
                  type="button"
                  onClick={closeForgotPasswordModal}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Back to login
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Enter the username or email you use to log in. We&apos;ll send you a temporary
                  password.
                </p>
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="forgot-password-login"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Username or email
                    </label>
                    <input
                      id="forgot-password-login"
                      type="text"
                      value={forgotPasswordLogin}
                      onChange={(e) => setForgotPasswordLogin(e.target.value)}
                      autoComplete="username"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your login"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeForgotPasswordModal}
                      className="flex-1 py-2.5 px-4 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Back to login
                    </button>
                    <button
                      type="submit"
                      disabled={forgotPasswordSubmitting || !forgotPasswordLogin.trim()}
                      className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center gap-2"
                    >
                      {forgotPasswordSubmitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send temporary password'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </AuthLayout>
  )
}
