import { useState, useEffect } from 'react'
import './validation-v2.css'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2, Save, AlertCircle, Tag, Users } from 'lucide-react'
import {
  validationService,
  type ValidationKeyPrefix,
  type ValidationTag,
  type ValidationCriterionTemplate,
} from '../../services/validation.service'

// V-Q2: settings page now matches the rest of the Validation module — pv- CSS
// variables (forest accent), no Tailwind dark-mode tokens, no blue. Blue is
// reserved for the rare status.info slot per design-system.md §3.1.

const TAG_PALETTE = ['#1B4332', '#B8860B', '#8B0000', '#2D4A63', '#6B6660']

const PANEL_STYLE: React.CSSProperties = {
  border: '1px solid var(--pv-line)',
  borderRadius: 6,
  padding: 16,
  background: 'var(--pv-bg)',
}

const ADD_LINK_STYLE: React.CSSProperties = {
  fontSize: 12,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  background: 'transparent',
  border: 0,
  color: 'var(--pv-green, #1B4332)',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit',
}

const INPUT_STYLE: React.CSSProperties = {
  height: 28,
  padding: '0 8px',
  fontSize: 12,
  border: '1px solid var(--pv-line)',
  borderRadius: 4,
  background: 'var(--pv-bg)',
  color: 'var(--pv-fg)',
}

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

  // V-Q6: surface who currently holds the Validation Approver engineering role
  // on this project. Editing is centralised in Stakeholders → Roles & assignments;
  // this is a read-only list with a deep link.
  const { data: approvers = [] } = useQuery({
    queryKey: ['validation-approvers', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await validationService.listApprovers(projectId!)
      return res.success && res.data ? res.data : []
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
      <div className="params-v2 validation-v2 space-y-4" style={{ padding: '16px 24px' }}>
        <Link
          to={`/projects/${projectId}/validation`}
          className="pv-btn"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={14} /> Back to Validation
        </Link>
        <div
          style={{
            border: '1px solid var(--pv-amber)',
            borderRadius: 6,
            padding: 12,
            background: 'var(--pv-surface-soft)',
          }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--pv-amber)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              margin: 0,
            }}
          >
            <AlertCircle size={14} /> Read-only
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--pv-fg-2)' }}>
            Editing Validation settings requires Project Owner or admin privileges. Ask the
            project owner to make changes here.
          </p>
        </div>
        <ReadOnlyView prefixes={prefixes} tags={tags} />
      </div>
    )
  }

  return (
    <div className="params-v2 validation-v2 space-y-4" style={{ padding: '16px 24px' }}>
      <div className="pv-title-row">
        <div>
          <h1>Validation — Settings</h1>
          <p className="pv-title-meta">
            Configure key prefixes, tag library, and criterion templates for this project.
            Project Owner / admin only.
          </p>
        </div>
        <div className="pv-right" style={{ display: 'flex', gap: 8 }}>
          <Link to={`/projects/${projectId}/validation`} className="pv-btn">
            <ArrowLeft size={14} /> Back to Validation
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="pv-btn primary"
            aria-keyshortcuts="Control+S Meta+S"
            title="Save settings (Cmd+S)"
          >
            <Save size={14} /> {saving ? 'Saving…' : okFlash ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            border: '1px solid var(--pv-red, #8B0000)',
            borderRadius: 4,
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--pv-red, #8B0000)',
            background: 'var(--pv-surface-soft)',
          }}
        >
          {error}
        </div>
      )}

      <section style={PANEL_STYLE}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--pv-fg)' }}>
              Key prefixes
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--pv-fg-3)' }}>
              Prefixes are appended to the auto-incremented number (e.g.{' '}
              <code style={{ fontFamily: 'var(--pv-font-mono)' }}>VAL-001</code>,{' '}
              <code style={{ fontFamily: 'var(--pv-font-mono)' }}>VAL-SYS-001</code>). Use
              uppercase letters/digits/dashes ending in a dash. Mark one as the default.
            </p>
          </div>
          <button type="button" onClick={addPrefix} style={ADD_LINK_STYLE}>
            <Plus size={12} /> Add prefix
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr 2fr 80px 24px',
            gap: 8,
            padding: '0 6px',
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--pv-fg-3)' }}>
            Prefix
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--pv-fg-3)' }}>
            Label
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--pv-fg-3)' }}>
            Description
          </span>
          <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--pv-fg-3)' }}>
            Default
          </span>
          <span />
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {prefixes.map((p, i) => (
            <li
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr 2fr 80px 24px',
                gap: 8,
                padding: 6,
                alignItems: 'center',
                border: '1px solid var(--pv-line)',
                borderRadius: 4,
                background: 'var(--pv-surface-soft)',
              }}
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
                style={{ ...INPUT_STYLE, fontFamily: 'var(--pv-font-mono)' }}
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
                style={INPUT_STYLE}
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
                style={INPUT_STYLE}
              />
              <label
                style={{
                  fontSize: 11,
                  color: 'var(--pv-fg-2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
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
                className="pv-icon-btn"
                style={{ width: 22, height: 22 }}
                aria-label="Remove prefix"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section style={PANEL_STYLE}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--pv-fg)' }}>
              Tag library
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--pv-fg-3)' }}>
              Tags items can carry. Items can only use tags listed here — keeps the set
              navigable. Pick a colour from the regulated-industry palette.
            </p>
          </div>
          <button type="button" onClick={addTag} style={ADD_LINK_STYLE}>
            <Plus size={12} /> Add tag
          </button>
        </div>
        {tags.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--pv-fg-3)', fontStyle: 'italic', margin: 0 }}>
            No tags yet. Add one to get started.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 8,
            }}
          >
            {tags.map((t, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 6,
                  border: '1px solid var(--pv-line)',
                  borderRadius: 4,
                  background: 'var(--pv-surface-soft)',
                }}
              >
                <input
                  type="color"
                  value={t.color}
                  onChange={(e) => {
                    const next = [...tags]
                    next[i] = { ...t, color: e.target.value }
                    setTags(next)
                  }}
                  style={{ height: 26, width: 30, border: '1px solid var(--pv-line)', borderRadius: 4, padding: 0 }}
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
                  style={{ ...INPUT_STYLE, flex: 1 }}
                />
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 4,
                    backgroundColor: `${t.color}22`,
                    color: t.color,
                  }}
                >
                  <Tag size={10} /> {t.label}
                </span>
                <button
                  type="button"
                  onClick={() => removeTag(i)}
                  className="pv-icon-btn"
                  style={{ width: 22, height: 22 }}
                  aria-label="Remove tag"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={PANEL_STYLE}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--pv-fg)' }}>
              Criterion templates
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--pv-fg-3)' }}>
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
            style={ADD_LINK_STYLE}
          >
            <Plus size={12} /> Add template
          </button>
        </div>
        {criterionTemplates.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--pv-fg-3)', fontStyle: 'italic', margin: 0 }}>
            No templates yet. Add one and it appears in the drawer's Templates dropdown for every
            validation item in this project.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {criterionTemplates.map((t, i) => (
              <li
                key={i}
                style={{
                  padding: 8,
                  border: '1px solid var(--pv-line)',
                  borderRadius: 4,
                  background: 'var(--pv-surface-soft)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={t.label}
                    onChange={(e) => {
                      const next = [...criterionTemplates]
                      next[i] = { ...t, label: e.target.value }
                      setCriterionTemplates(next)
                    }}
                    placeholder="Template label"
                    style={{ ...INPUT_STYLE, flex: 1, fontWeight: 500 }}
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
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {t.criteria.map((c, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                        style={{ ...INPUT_STYLE, flex: 1 }}
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
                  style={{ ...ADD_LINK_STYLE, marginTop: 8 }}
                >
                  <Plus size={11} /> Add criterion
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={PANEL_STYLE}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--pv-fg)' }}>
              Validation Approver members
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--pv-fg-3)' }}>
              Project members who hold the system-defined{' '}
              <span style={{ fontWeight: 500, color: 'var(--pv-fg-2)' }}>Validation Approver</span>{' '}
              engineering role. Only approvers (or platform admins) can sign off validation items.
              Assignment lives in the Stakeholders module.
            </p>
          </div>
          <Link
            to={`/projects/${projectId}/stakeholders/roles`}
            className="pv-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Users size={14} /> Manage assignments
          </Link>
        </div>
        {approvers.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--pv-fg-3)', fontStyle: 'italic', margin: 0 }}>
            No approvers assigned yet. Sign-offs will be rejected until at least one project
            member holds the role.
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {approvers.map((a) => (
              <li
                key={a.id}
                title={a.email}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  border: '1px solid var(--pv-line)',
                  borderRadius: 12,
                  fontSize: 12,
                  background: 'var(--pv-surface-soft)',
                  color: 'var(--pv-fg-2)',
                }}
              >
                <Users size={11} style={{ color: 'var(--pv-green, #1B4332)' }} />
                {a.name || a.email}
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
      <section style={PANEL_STYLE}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: 'var(--pv-fg)' }}>
          Key prefixes
        </h2>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {prefixes.map((p, i) => (
            <li key={i} style={{ fontSize: 13, color: 'var(--pv-fg-2)', padding: '2px 0' }}>
              <code style={{ fontFamily: 'var(--pv-font-mono)' }}>{p.prefix}</code> — {p.label}
              {p.isDefault && (
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--pv-fg-3)' }}>
                  (default)
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section style={PANEL_STYLE}>
        <h2 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: 'var(--pv-fg)' }}>
          Tag library
        </h2>
        {tags.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--pv-fg-3)', fontStyle: 'italic', margin: 0 }}>
            No tags.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {tags.map((t, i) => (
              <li
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 4,
                  backgroundColor: `${t.color}22`,
                  color: t.color,
                }}
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
