import { useState, useEffect } from 'react'
import './validation-v2.css'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Plus, Trash2, Save, AlertCircle, Tag } from 'lucide-react'
import {
  validationService,
  type ValidationKeyPrefix,
  type ValidationTag,
  type ValidationCriterionTemplate,
} from '../../services/validation.service'

const TAG_PALETTE = ['#1B4332', '#B8860B', '#8B0000', '#2D4A63', '#6B6660']

export default function ValidationSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [prefixes, setPrefixes] = useState<ValidationKeyPrefix[]>([])
  const [tags, setTags] = useState<ValidationTag[]>([])
  const [criterionTemplates, setCriterionTemplates] = useState<ValidationCriterionTemplate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [okFlash, setOkFlash] = useState(false)
  const [forbidden, setForbidden] = useState(false)

  const { data: settings, refetch } = useQuery({
    queryKey: ['validation-settings', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await validationService.getSettings(projectId!)
      if (!res.success) return null
      return res.data ?? null
    },
  })

  useEffect(() => {
    if (settings) {
      setPrefixes(settings.prefixes ?? [])
      setTags(settings.tags ?? [])
      setCriterionTemplates(settings.criterionTemplates ?? [])
    }
  }, [settings])

  useEffect(() => {
    const prev = document.title
    document.title = 'Validation · Settings · Tool'
    return () => {
      document.title = prev
    }
  }, [])

  if (!projectId) return null

  const save = async () => {
    setError(null)
    setSaving(true)
    const res = await validationService.updateSettings(projectId, {
      prefixes,
      tags,
      criterionTemplates,
    })
    setSaving(false)
    if (res.success) {
      setOkFlash(true)
      setTimeout(() => setOkFlash(false), 1500)
      refetch()
    } else {
      const msg = res.error ?? 'Failed to save settings'
      if (msg.toLowerCase().includes('access denied') || msg.toLowerCase().includes('owner')) {
        setForbidden(true)
      } else {
        setError(msg)
      }
    }
  }

  const addPrefix = () =>
    setPrefixes([...prefixes, { prefix: 'NEW-', label: 'New', isDefault: false }])
  const removePrefix = (i: number) => setPrefixes(prefixes.filter((_, k) => k !== i))
  const setDefault = (i: number) =>
    setPrefixes(prefixes.map((p, k) => ({ ...p, isDefault: k === i })))

  const addTag = () =>
    setTags([...tags, { label: 'new-tag', color: TAG_PALETTE[tags.length % TAG_PALETTE.length] }])
  const removeTag = (i: number) => setTags(tags.filter((_, k) => k !== i))

  if (forbidden) {
    return (
      <div className="space-y-4">
        <Link
          to={`/projects/${projectId}/validation`}
          className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300 hover:underline"
        >
          <ChevronLeft size={14} /> Back to Validation
        </Link>
        <div className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 p-4">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <AlertCircle size={14} /> Read-only
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Editing Validation settings requires Project Owner or admin privileges. Ask the
            project owner to make changes here.
          </p>
        </div>
        <ReadOnlyView prefixes={prefixes} tags={tags} />
      </div>
    )
  }

  return (
    <div className="params-v2 validation-v2 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to={`/projects/${projectId}/validation`}
            className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:underline"
          >
            <ChevronLeft size={12} /> Back to Validation
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-1">
            Validation settings
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure key prefixes and tag library for this project. Project Owner / admin only.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={14} /> {saving ? 'Saving…' : okFlash ? 'Saved' : 'Save'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Key prefixes</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Prefixes are appended to the auto-incremented number (e.g. <code className="font-mono">VAL-001</code>,{' '}
              <code className="font-mono">VAL-SYS-001</code>). Use uppercase letters/digits/dashes ending in a dash.
              Mark one as the default.
            </p>
          </div>
          <button
            type="button"
            onClick={addPrefix}
            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700"
          >
            <Plus size={12} /> Add prefix
          </button>
        </div>
        <div className="grid grid-cols-12 gap-2 px-2 mb-1">
          <span className="col-span-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Prefix</span>
          <span className="col-span-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Label</span>
          <span className="col-span-5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Description</span>
          <span className="col-span-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Default</span>
          <span className="col-span-1" />
        </div>
        <ul className="space-y-2">
          {prefixes.map((p, i) => (
            <li
              key={i}
              className="grid grid-cols-12 gap-2 items-center border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800/50 p-2"
            >
              <input
                type="text"
                value={p.prefix}
                onChange={(e) => {
                  const next = [...prefixes]
                  next[i] = { ...p, prefix: e.target.value.toUpperCase() }
                  setPrefixes(next)
                }}
                placeholder="VAL-"
                aria-label="Key prefix"
                className="col-span-2 px-2 py-1 text-sm font-mono border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
              />
              <input
                type="text"
                value={p.label}
                onChange={(e) => {
                  const next = [...prefixes]
                  next[i] = { ...p, label: e.target.value }
                  setPrefixes(next)
                }}
                placeholder="Validation"
                aria-label="Prefix label"
                className="col-span-3 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
              />
              <input
                type="text"
                value={p.description ?? ''}
                onChange={(e) => {
                  const next = [...prefixes]
                  next[i] = { ...p, description: e.target.value }
                  setPrefixes(next)
                }}
                placeholder="When this prefix applies"
                aria-label="Prefix description"
                className="col-span-5 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
              />
              <label className="col-span-1 text-xs flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <input
                  type="radio"
                  name="default-prefix"
                  checked={!!p.isDefault}
                  onChange={() => setDefault(i)}
                />
                default
              </label>
              <button
                type="button"
                onClick={() => removePrefix(i)}
                className="col-span-1 text-gray-400 hover:text-red-600 flex justify-end"
                aria-label="Remove prefix"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tag library</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Tags items can carry. Items can only use tags listed here — keeps the set
              navigable. Pick a colour from the regulated-industry palette.
            </p>
          </div>
          <button
            type="button"
            onClick={addTag}
            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700"
          >
            <Plus size={12} /> Add tag
          </button>
        </div>
        {tags.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No tags yet. Add one to get started.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {tags.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800/50 p-2"
              >
                <input
                  type="color"
                  value={t.color}
                  onChange={(e) => {
                    const next = [...tags]
                    next[i] = { ...t, color: e.target.value }
                    setTags(next)
                  }}
                  className="h-7 w-7 border border-gray-300 dark:border-gray-700 rounded"
                  title="Tag colour"
                />
                <input
                  type="text"
                  value={t.label}
                  onChange={(e) => {
                    const next = [...tags]
                    next[i] = { ...t, label: e.target.value.toLowerCase().replace(/\s+/g, '-') }
                    setTags(next)
                  }}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                />
                <span
                  className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${t.color}22`, color: t.color }}
                >
                  <Tag size={10} /> {t.label}
                </span>
                <button
                  type="button"
                  onClick={() => removeTag(i)}
                  className="text-gray-400 hover:text-red-600"
                  aria-label="Remove tag"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Criterion templates
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Reusable acceptance-criteria sets that everyone in the project can insert from the
              drawer. Each template is a labelled list of criterion texts.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setCriterionTemplates([
                ...criterionTemplates,
                { label: 'New template', criteria: ['Criterion 1'] },
              ])
            }
            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            <Plus size={12} /> Add template
          </button>
        </div>
        {criterionTemplates.length === 0 ? (
          <p className="text-xs text-gray-500 italic">
            No templates yet. Add one and it appears in the drawer's Templates dropdown for every
            validation item in this project.
          </p>
        ) : (
          <ul className="space-y-3">
            {criterionTemplates.map((t, i) => (
              <li
                key={i}
                className="border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={t.label}
                    onChange={(e) => {
                      const next = [...criterionTemplates]
                      next[i] = { ...t, label: e.target.value }
                      setCriterionTemplates(next)
                    }}
                    placeholder="Template label"
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCriterionTemplates(criterionTemplates.filter((_, k) => k !== i))
                    }
                    className="pv-icon-btn"
                    style={{ width: 24, height: 24 }}
                    aria-label="Remove template"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <ul className="space-y-1">
                  {t.criteria.map((c, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={c}
                        onChange={(e) => {
                          const next = [...criterionTemplates]
                          const nc = [...t.criteria]
                          nc[j] = e.target.value
                          next[i] = { ...t, criteria: nc }
                          setCriterionTemplates(next)
                        }}
                        placeholder="Criterion text"
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...criterionTemplates]
                          next[i] = { ...t, criteria: t.criteria.filter((_, k) => k !== j) }
                          setCriterionTemplates(next)
                        }}
                        className="pv-icon-btn"
                        style={{ width: 22, height: 22 }}
                        aria-label="Remove criterion"
                        disabled={t.criteria.length <= 1}
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    const next = [...criterionTemplates]
                    next[i] = { ...t, criteria: [...t.criteria, ''] }
                    setCriterionTemplates(next)
                  }}
                  className="text-xs flex items-center gap-1 mt-2 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <Plus size={11} /> Add criterion
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function ReadOnlyView({
  prefixes,
  tags,
}: {
  prefixes: ValidationKeyPrefix[]
  tags: ValidationTag[]
}) {
  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Key prefixes</h2>
        <ul className="space-y-1">
          {prefixes.map((p, i) => (
            <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
              <code className="font-mono">{p.prefix}</code> — {p.label}
              {p.isDefault && <span className="ml-2 text-xs text-gray-500">(default)</span>}
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Tag library</h2>
        {tags.length === 0 ? (
          <p className="text-xs text-gray-500 italic">No tags.</p>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {tags.map((t, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${t.color}22`, color: t.color }}
              >
                <Tag size={10} /> {t.label}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
