import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, UserPlus, ArrowLeft } from 'lucide-react'
import {
  getOrganizations,
  createPlatformUser,
  type PlatformAdminOrganizationItem,
} from '../../services/platformAdmin.service'

export default function CreateCompanyAdminPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [company, setCompany] = useState<string>('')
  const [makeCompanyAdmin, setMakeCompanyAdmin] = useState(true)
  const [organizations, setOrganizations] = useState<PlatformAdminOrganizationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    getOrganizations()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setOrganizations(res.data)
          if (res.data.length > 0 && !company) {
            setCompany(res.data[0].companyKey)
          }
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!email.trim()) {
      setError('Email is required')
      return
    }
    if (!email.trim().includes('@')) {
      setError('Invalid email format')
      return
    }
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const res = await createPlatformUser({
        email: email.trim(),
        name: name.trim(),
        password,
        company: company === '' || company === '__null__' ? null : company,
        makeCompanyAdmin,
      })
      if (res.success) {
        setSuccess(
          `User created successfully. Email: ${res.data!.user.email}. Share the password securely with the user.`
        )
        setEmail('')
        setName('')
        setPassword('')
        setPasswordConfirm('')
      } else {
        setError(res.error || 'Failed to create user')
      }
    } catch (err) {
      setError((err as Error)?.message || 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm'
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'

  return (
    <div>
      <Link
        to="/platform-admin"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
      >
        <ArrowLeft size={16} />
        Back to overview
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Create company admin
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Create a user with explicit credentials. Optionally assign company admin role for company-level management.
      </p>

      <div className="max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        {loading && (
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 py-8">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading organizations…</span>
          </div>
        )}

        {!loading && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
            )}
            <div>
              <label className={labelClass}>
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                required
                placeholder="admin@company.com"
              />
            </div>
            <div>
              <label className={labelClass}>
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                required
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className={labelClass}>
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
                minLength={8}
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label className={labelClass}>Confirm password</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className={inputClass}
                placeholder="Re-enter password"
              />
            </div>
            <div>
              <label className={labelClass}>Company</label>
              <select
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className={inputClass}
              >
                <option value="">(None / unnamed)</option>
                {organizations.map((org) => (
                  <option key={org.companyKey} value={org.companyKey}>
                    {org.displayName || org.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="makeCompanyAdmin"
                checked={makeCompanyAdmin}
                onChange={(e) => setMakeCompanyAdmin(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="makeCompanyAdmin" className="text-sm text-gray-700 dark:text-gray-300">
                Make company admin (can manage users in this company)
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <Link
                to="/platform-admin"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-center"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <UserPlus size={16} />
                )}
                Create user
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
