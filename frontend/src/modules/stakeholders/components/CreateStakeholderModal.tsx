import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Stakeholder, StakeholderType, Discipline, AuthorityLevel, StakeholderStatus } from '../types'
import { useStakeholdersStore } from '../store'

const STAKEHOLDER_TYPES: StakeholderType[] = ['Internal', 'Supplier', 'Partner', 'Authority', 'Customer']
const DISCIPLINES: Discipline[] = [
  'Systems', 'Safety', 'Verification', 'CM', 'Certification', 'SW', 'HW', 'QA', 'PM', 'Manufacturing',
]
const AUTHORITY_LEVELS: AuthorityLevel[] = ['Viewer', 'Reviewer', 'Approver', 'Owner']
const STATUSES: StakeholderStatus[] = ['Active', 'Inactive']

interface CreateStakeholderModalProps {
  isOpen: boolean
  onClose: () => void
  editStakeholder: Stakeholder | null
  onSaved: () => void
}

const emptyStakeholder = (): Omit<Stakeholder, 'stakeholderId' | 'createdAt' | 'updatedAt'> => ({
  displayName: '',
  organization: '',
  stakeholderType: 'Internal',
  discipline: 'Systems',
  roles: [],
  authorityLevel: 'Viewer',
  scopes: [],
  status: 'Active',
})

export default function CreateStakeholderModal({
  isOpen,
  onClose,
  editStakeholder,
  onSaved,
}: CreateStakeholderModalProps) {
  const { state, dispatch, nextStakeholderId } = useStakeholdersStore()
  const [form, setForm] = useState(emptyStakeholder())
  const [rolesText, setRolesText] = useState('')
  const [scopesText, setScopesText] = useState('')

  useEffect(() => {
    if (editStakeholder) {
      setForm({
        displayName: editStakeholder.displayName,
        organization: editStakeholder.organization,
        stakeholderType: editStakeholder.stakeholderType,
        discipline: editStakeholder.discipline,
        roles: editStakeholder.roles,
        authorityLevel: editStakeholder.authorityLevel,
        scopes: editStakeholder.scopes,
        location: editStakeholder.location,
        timezone: editStakeholder.timezone,
        contact: editStakeholder.contact,
        status: editStakeholder.status,
        notes: editStakeholder.notes,
      })
      setRolesText(editStakeholder.roles.join(', '))
      setScopesText(editStakeholder.scopes.join(', '))
    } else {
      setForm(emptyStakeholder())
      setRolesText('')
      setScopesText('')
    }
  }, [editStakeholder, isOpen])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const roles = rolesText.split(',').map((s) => s.trim()).filter(Boolean)
    const scopes = scopesText.split(',').map((s) => s.trim()).filter(Boolean)
    const now = new Date().toISOString()

    if (editStakeholder) {
      dispatch({
        type: 'UPDATE_STAKEHOLDER',
        payload: {
          ...editStakeholder,
          ...form,
          roles,
          scopes,
          updatedAt: now,
        },
      })
    } else {
      const stakeholderId = nextStakeholderId()
      dispatch({
        type: 'CREATE_STAKEHOLDER',
        payload: {
          stakeholderId,
          ...form,
          roles,
          scopes,
          createdAt: now,
          updatedAt: now,
        },
      })
    }
    onSaved()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {editStakeholder ? 'Edit Stakeholder' : 'Create Stakeholder'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <form id="create-stakeholder-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display name *</label>
            <input
              type="text"
              required
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Organization *</label>
            <input
              type="text"
              required
              value={form.organization}
              onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
              <select
                value={form.stakeholderType}
                onChange={(e) => setForm((f) => ({ ...f, stakeholderType: e.target.value as StakeholderType }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                {STAKEHOLDER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discipline</label>
              <select
                value={form.discipline}
                onChange={(e) => setForm((f) => ({ ...f, discipline: e.target.value as Discipline }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                {DISCIPLINES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Roles (comma-separated)</label>
            <input
              type="text"
              value={rolesText}
              onChange={(e) => setRolesText(e.target.value)}
              placeholder="e.g. System Engineer, CCB Member"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Authority</label>
              <select
                value={form.authorityLevel}
                onChange={(e) => setForm((f) => ({ ...f, authorityLevel: e.target.value as AuthorityLevel }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                {AUTHORITY_LEVELS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as StakeholderStatus }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Scopes (comma-separated)</label>
            <input
              type="text"
              value={scopesText}
              onChange={(e) => setScopesText(e.target.value)}
              placeholder="e.g. FCS, Avionics"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
              <input
                type="text"
                value={form.location ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value || undefined }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timezone</label>
              <input
                type="text"
                value={form.timezone ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value || undefined }))}
                placeholder="e.g. America/Los_Angeles"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                type="email"
                value={form.contact?.email ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact: { ...f.contact, email: e.target.value || undefined } }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input
                type="text"
                value={form.contact?.phone ?? ''}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact: { ...f.contact, phone: e.target.value || undefined } }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || undefined }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-stakeholder-form"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            {editStakeholder ? 'Save' : 'Create'}
          </button>
        </div>
        </form>
      </div>
    </div>
  )
}
