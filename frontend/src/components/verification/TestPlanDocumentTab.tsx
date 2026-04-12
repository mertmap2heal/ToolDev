import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Save, Check, X, Edit2 } from 'lucide-react'
import clsx from 'clsx'
import { verificationService } from '../../services/verification.service'
import { format } from 'date-fns'

export type DocApplicableRow = { title: string; revision?: string; date?: string; publisher?: string }
export type DocToolRow = {
  name: string
  manufacturer?: string
  partNumber?: string
  serialNumber?: string
  calibrationValidTill?: string
}

function toDateInput(iso?: string | Date | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function generalConditionsToText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v !== null && 'text' in (v as object)) {
    const t = (v as { text?: unknown }).text
    if (typeof t === 'string') return t
  }
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return ''
  }
}

function normalizeApplicableDocs(raw: unknown): DocApplicableRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((d: any) => ({
    title: String(d?.title ?? ''),
    revision: d?.revision != null ? String(d.revision) : '',
    date: d?.date != null ? String(d.date) : '',
    publisher: d?.publisher != null ? String(d.publisher) : '',
  }))
}

function normalizeTools(raw: unknown): DocToolRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((t: any) => ({
    name: String(t?.name ?? ''),
    manufacturer: t?.manufacturer != null ? String(t.manufacturer) : '',
    partNumber: t?.partNumber != null ? String(t.partNumber) : '',
    serialNumber: t?.serialNumber != null ? String(t.serialNumber) : '',
    calibrationValidTill: t?.calibrationValidTill != null ? String(t.calibrationValidTill) : '',
  }))
}

type Props = {
  projectId: string
  planId: string
  plan: any
  onOpenSetup?: (setup: any) => void
}

export default function TestPlanDocumentTab({ projectId, planId, plan, onOpenSetup }: Props) {
  const queryClient = useQueryClient()
  const [docNumber, setDocNumber] = useState('')
  const [docConfidentiality, setDocConfidentiality] = useState('')
  const [docProjectCode, setDocProjectCode] = useState('')
  const [docRevision, setDocRevision] = useState('')
  const [docPlanDate, setDocPlanDate] = useState('')
  const [docPreparedByName, setDocPreparedByName] = useState('')
  const [docQaByName, setDocQaByName] = useState('')
  const [docApprovedByName, setDocApprovedByName] = useState('')
  const [docApprovedAt, setDocApprovedAt] = useState('')
  const [docPurpose, setDocPurpose] = useState('')
  const [docOverview, setDocOverview] = useState('')
  const [docStatementOfConformity, setDocStatementOfConformity] = useState('')
  const [docChangesPolicy, setDocChangesPolicy] = useState('')
  const [docDistribution, setDocDistribution] = useState('')
  const [docAcronymsNote, setDocAcronymsNote] = useState('')
  const [docGeneralPrecautions, setDocGeneralPrecautions] = useState('')
  const [docTestSetupNotes, setDocTestSetupNotes] = useState('')
  const [docGeneralConditionsText, setDocGeneralConditionsText] = useState('')
  const [applicableDocs, setApplicableDocs] = useState<DocApplicableRow[]>([])
  const [tools, setTools] = useState<DocToolRow[]>([])
  const [appendices, setAppendices] = useState<Array<{ title: string; content: string }>>([])


  const [newRev, setNewRev] = useState({
    revisionNumber: '',
    revisionDate: '',
    editedByName: '',
    approvedByName: '',
    approvedAt: '',
    summaryOfChanges: '',
  })

  const syncFromPlan = useCallback(() => {
    if (!plan) return
    setDocNumber(plan.docNumber ?? '')
    setDocConfidentiality(plan.docConfidentiality ?? '')
    setDocProjectCode(plan.docProjectCode ?? '')
    setDocRevision(plan.docRevision ?? '1.0')
    setDocPlanDate(toDateInput(plan.docPlanDate))
    setDocPreparedByName(plan.docPreparedByName ?? '')
    setDocQaByName(plan.docQaByName ?? '')
    setDocApprovedByName(plan.docApprovedByName ?? '')
    setDocApprovedAt(toDateInput(plan.docApprovedAt))
    setDocPurpose(plan.docPurpose ?? '')
    setDocOverview(plan.docOverview ?? '')
    setDocStatementOfConformity(plan.docStatementOfConformity ?? '')
    setDocChangesPolicy(plan.docChangesPolicy ?? '')
    setDocDistribution(plan.docDistribution ?? '')
    setDocAcronymsNote(plan.docAcronymsNote ?? '')
    setDocGeneralPrecautions(plan.docGeneralPrecautions ?? '')
    setDocTestSetupNotes(plan.docTestSetupNotes ?? '')
    setDocGeneralConditionsText(generalConditionsToText(plan.docGeneralConditions))
    const ad = normalizeApplicableDocs(plan.docApplicableDocuments)
    setApplicableDocs(ad.length ? ad : [{ title: '', revision: '', date: '', publisher: '' }])
    const tl = normalizeTools(plan.docTools)
    setTools(
      tl.length
        ? tl
        : [{ name: '', manufacturer: '', partNumber: '', serialNumber: '', calibrationValidTill: '' }]
    )
    const rawAppx = Array.isArray(plan.docAppendices) ? plan.docAppendices : []
    setAppendices(rawAppx.map((a: any) => ({ title: String(a?.title ?? ''), content: String(a?.content ?? '') })))
  }, [plan])

  useEffect(() => {
    syncFromPlan()
  }, [syncFromPlan, plan?.id, plan?.updatedAt])

  const saveDocMutation = useMutation({
    mutationFn: async () => {
      const cleanApplicable = applicableDocs
        .filter((r) => r.title.trim())
        .map((r) => ({
          title: r.title.trim(),
          ...(r.revision?.trim() ? { revision: r.revision.trim() } : {}),
          ...(r.date?.trim() ? { date: r.date.trim() } : {}),
          ...(r.publisher?.trim() ? { publisher: r.publisher.trim() } : {}),
        }))
      const cleanTools = tools
        .filter((t) => t.name.trim())
        .map((t) => ({
          name: t.name.trim(),
          ...(t.manufacturer?.trim() ? { manufacturer: t.manufacturer.trim() } : {}),
          ...(t.partNumber?.trim() ? { partNumber: t.partNumber.trim() } : {}),
          ...(t.serialNumber?.trim() ? { serialNumber: t.serialNumber.trim() } : {}),
          ...(t.calibrationValidTill?.trim() ? { calibrationValidTill: t.calibrationValidTill.trim() } : {}),
        }))
      const payload: Record<string, unknown> = {
        docNumber: docNumber.trim() || null,
        docConfidentiality: docConfidentiality.trim() || null,
        docProjectCode: docProjectCode.trim() || null,
        docRevision: docRevision.trim() || null,
        docPlanDate: docPlanDate ? new Date(docPlanDate + 'T12:00:00').toISOString() : null,
        docPreparedByName: docPreparedByName.trim() || null,
        docQaByName: docQaByName.trim() || null,
        docApprovedByName: docApprovedByName.trim() || null,
        docApprovedAt: docApprovedAt ? new Date(docApprovedAt + 'T12:00:00').toISOString() : null,
        docPurpose: docPurpose.trim() || null,
        docOverview: docOverview.trim() || null,
        docStatementOfConformity: docStatementOfConformity.trim() || null,
        docChangesPolicy: docChangesPolicy.trim() || null,
        docDistribution: docDistribution.trim() || null,
        docAcronymsNote: docAcronymsNote.trim() || null,
        docGeneralPrecautions: docGeneralPrecautions.trim() || null,
        docTestSetupNotes: docTestSetupNotes.trim() || null,
        docApplicableDocuments: cleanApplicable.length ? cleanApplicable : null,
        docTools: cleanTools.length ? cleanTools : null,
        docGeneralConditions: docGeneralConditionsText.trim()
          ? { text: docGeneralConditionsText.trim() }
          : null,
        docAppendices: appendices.filter((a) => a.title.trim()).map((a) => ({ title: a.title.trim(), content: a.content.trim() })),
      }
      const res = await verificationService.updateTestPlan(projectId, planId, payload)
      if (!(res as { success?: boolean }).success) {
        throw new Error((res as { error?: string }).error || 'Save failed')
      }
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-plan', projectId, planId] })
      queryClient.invalidateQueries({ queryKey: ['test-plans', projectId] })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
  })

  const createRevMutation = useMutation({
    mutationFn: async () => {
      const res = (await verificationService.createTestPlanRevision(projectId, planId, {
        revisionNumber: newRev.revisionNumber.trim(),
        revisionDate: newRev.revisionDate ? new Date(newRev.revisionDate + 'T12:00:00').toISOString() : null,
        editedByName: newRev.editedByName.trim() || null,
        approvedByName: newRev.approvedByName.trim() || null,
        approvedAt: newRev.approvedAt ? new Date(newRev.approvedAt + 'T12:00:00').toISOString() : null,
        summaryOfChanges: newRev.summaryOfChanges.trim() || null,
      })) as { success?: boolean; error?: string }
      if (!res?.success) throw new Error(res?.error || 'Failed to add revision')
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-plan', projectId, planId] })
      setNewRev({
        revisionNumber: '',
        revisionDate: '',
        editedByName: '',
        approvedByName: '',
        approvedAt: '',
        summaryOfChanges: '',
      })
    },
  })

  const updateRevMutation = useMutation({
    mutationFn: async ({ revisionId, data }: { revisionId: string; data: Record<string, unknown> }) => {
      const res = (await verificationService.updateTestPlanRevision(projectId, planId, revisionId, data)) as {
        success?: boolean
        error?: string
      }
      if (!res?.success) throw new Error(res?.error || 'Failed to update revision')
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-plan', projectId, planId] })
      setEditingRevId(null)
      setEditingRevData(null)
    },
  })

  const deleteRevMutation = useMutation({
    mutationFn: async (revisionId: string) => {
      const res = (await verificationService.deleteTestPlanRevision(projectId, planId, revisionId)) as {
        success?: boolean
        error?: string
      }
      if (!res?.success) throw new Error(res?.error || 'Failed to delete revision')
      return res
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['test-plan', projectId, planId] }),
  })

  const [editingRevId, setEditingRevId] = useState<string | null>(null)
  const [editingRevData, setEditingRevData] = useState<{
    revisionNumber: string
    revisionDate: string
    editedByName: string
    approvedByName: string
    summaryOfChanges: string
  } | null>(null)

  const [saveSuccess, setSaveSuccess] = useState(false)

  const revisions = useMemo(() => (Array.isArray(plan?.revisions) ? plan.revisions : []) as any[], [plan?.revisions])
  const planSetups = useMemo(() => {
    const join = Array.isArray(plan?.planSetups) ? plan.planSetups : []
    return join.map((ps: any) => ps?.setup ?? ps).filter(Boolean)
  }, [plan?.planSetups])

  const inputClass =
    'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30'
  const labelClass = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Fields below appear in PDF/Word export. Purpose and Overview fall back to Description and Scope when left empty.
        </p>
        <button
          type="button"
          onClick={() => saveDocMutation.mutate()}
          disabled={saveDocMutation.isPending}
          className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors ${
            saveSuccess
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {saveSuccess ? <Check size={16} /> : <Save size={16} />}
          {saveDocMutation.isPending ? 'Saving...' : saveSuccess ? 'Saved' : 'Save document fields'}
        </button>
      </div>

      <section className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cover and identification</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Document number</label>
            <input className={inputClass} value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="e.g. TPL-10279003A-08-01" />
          </div>
          <div>
            <label className={labelClass}>Confidentiality</label>
            <input className={inputClass} value={docConfidentiality} onChange={(e) => setDocConfidentiality(e.target.value)} placeholder="e.g. INTERNAL" />
          </div>
          <div>
            <label className={labelClass}>Project code</label>
            <input className={inputClass} value={docProjectCode} onChange={(e) => setDocProjectCode(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Document revision</label>
            <input className={inputClass} value={docRevision} onChange={(e) => setDocRevision(e.target.value)} placeholder="1.0" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Test plan date (cover)</label>
            <input type="date" className={inputClass} value={docPlanDate} onChange={(e) => setDocPlanDate(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Signatures (export)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Prepared by</label>
            <input className={inputClass} value={docPreparedByName} onChange={(e) => setDocPreparedByName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>QA</label>
            <input className={inputClass} value={docQaByName} onChange={(e) => setDocQaByName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Approved by</label>
            <input className={inputClass} value={docApprovedByName} onChange={(e) => setDocApprovedByName(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Approved at</label>
            <input type="date" className={inputClass} value={docApprovedAt} onChange={(e) => setDocApprovedAt(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Export narrative sections</h3>
        <div>
          <label className={labelClass}>Introduction – Purpose (optional; else Description)</label>
          <textarea className={clsx(inputClass, 'resize-y min-h-[72px]')} rows={3} value={docPurpose} onChange={(e) => setDocPurpose(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Introduction – Overview (optional; else Scope)</label>
          <textarea className={clsx(inputClass, 'resize-y min-h-[72px]')} rows={3} value={docOverview} onChange={(e) => setDocOverview(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Statement of conformity</label>
          <textarea className={clsx(inputClass, 'resize-y min-h-[72px]')} rows={3} value={docStatementOfConformity} onChange={(e) => setDocStatementOfConformity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Changes policy</label>
          <textarea className={clsx(inputClass, 'resize-y min-h-[56px]')} rows={2} value={docChangesPolicy} onChange={(e) => setDocChangesPolicy(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Distribution</label>
          <textarea className={clsx(inputClass, 'resize-y min-h-[56px]')} rows={2} value={docDistribution} onChange={(e) => setDocDistribution(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Acronyms and abbreviations</label>
          <textarea className={clsx(inputClass, 'resize-y min-h-[56px]')} rows={2} value={docAcronymsNote} onChange={(e) => setDocAcronymsNote(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>General notes and precautions</label>
          <textarea className={clsx(inputClass, 'resize-y min-h-[72px]')} rows={3} value={docGeneralPrecautions} onChange={(e) => setDocGeneralPrecautions(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Test setup notes (export)</label>
          <textarea className={clsx(inputClass, 'resize-y min-h-[56px]')} rows={2} value={docTestSetupNotes} onChange={(e) => setDocTestSetupNotes(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>General conditions (plain text for export)</label>
          <textarea className={clsx(inputClass, 'resize-y min-h-[80px]')} rows={4} value={docGeneralConditionsText} onChange={(e) => setDocGeneralConditionsText(e.target.value)} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Applicable documents</h3>
          <button
            type="button"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            onClick={() => setApplicableDocs([...applicableDocs, { title: '', revision: '', date: '', publisher: '' }])}
          >
            <Plus size={14} /> Row
          </button>
        </div>
        <div className="space-y-2 overflow-x-auto">
          <div className="grid grid-cols-[minmax(8rem,1fr)_minmax(5rem,0.5fr)_minmax(6rem,0.6fr)_minmax(6rem,0.6fr)_2rem] gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[640px]">
            <span>Title</span>
            <span>Revision</span>
            <span>Date</span>
            <span>Publisher</span>
            <span />
          </div>
          {applicableDocs.map((row, i) => (
            <div key={i} className="grid grid-cols-[minmax(8rem,1fr)_minmax(5rem,0.5fr)_minmax(6rem,0.6fr)_minmax(6rem,0.6fr)_2rem] gap-2 min-w-[640px] items-center">
              <input className={inputClass} value={row.title} onChange={(e) => {
                const next = [...applicableDocs]
                next[i] = { ...next[i], title: e.target.value }
                setApplicableDocs(next)
              }} />
              <input className={inputClass} value={row.revision} onChange={(e) => {
                const next = [...applicableDocs]
                next[i] = { ...next[i], revision: e.target.value }
                setApplicableDocs(next)
              }} />
              <input className={inputClass} value={row.date} onChange={(e) => {
                const next = [...applicableDocs]
                next[i] = { ...next[i], date: e.target.value }
                setApplicableDocs(next)
              }} />
              <input className={inputClass} value={row.publisher} onChange={(e) => {
                const next = [...applicableDocs]
                next[i] = { ...next[i], publisher: e.target.value }
                setApplicableDocs(next)
              }} />
              <button
                type="button"
                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                onClick={() => setApplicableDocs(applicableDocs.filter((_, j) => j !== i))}
                aria-label="Remove row"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tools (export table)</h3>
          <button
            type="button"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            onClick={() =>
              setTools([
                ...tools,
                { name: '', manufacturer: '', partNumber: '', serialNumber: '', calibrationValidTill: '' },
              ])
            }
          >
            <Plus size={14} /> Row
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">Separate from Testing Tools checkboxes on Overview; this table is what appears in the formal export.</p>
        <div className="space-y-2 overflow-x-auto">
          <div className="grid grid-cols-[minmax(6rem,1fr)_repeat(4,minmax(5rem,0.8fr))_2rem] gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 min-w-[720px]">
            <span>Tool</span>
            <span>Mfr</span>
            <span>Part #</span>
            <span>Serial #</span>
            <span>Cal. valid</span>
            <span />
          </div>
          {tools.map((row, i) => (
            <div key={i} className="grid grid-cols-[minmax(6rem,1fr)_repeat(4,minmax(5rem,0.8fr))_2rem] gap-2 min-w-[720px] items-center">
              {(['name', 'manufacturer', 'partNumber', 'serialNumber', 'calibrationValidTill'] as const).map((k) => (
                <input
                  key={k}
                  className={inputClass}
                  value={row[k] ?? ''}
                  onChange={(e) => {
                    const next = [...tools]
                    next[i] = { ...next[i], [k]: e.target.value }
                    setTools(next)
                  }}
                />
              ))}
              <button
                type="button"
                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                onClick={() => setTools(tools.filter((_, j) => j !== i))}
                aria-label="Remove row"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Appendices</h3>
          <button
            type="button"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            onClick={() => setAppendices([...appendices, { title: '', content: '' }])}
          >
            <Plus size={14} /> Add appendix
          </button>
        </div>
        {appendices.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">No appendices. Click "Add appendix" to create one.</p>
        ) : (
          <div className="space-y-3">
            {appendices.map((appx, i) => (
              <div key={i} className="space-y-2 border-b border-gray-100 dark:border-gray-700 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    placeholder={`Appendix ${i + 1} title`}
                    value={appx.title}
                    onChange={(e) => {
                      const next = [...appendices]
                      next[i] = { ...next[i], title: e.target.value }
                      setAppendices(next)
                    }}
                  />
                  <button
                    type="button"
                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    onClick={() => setAppendices(appendices.filter((_, j) => j !== i))}
                    aria-label="Remove appendix"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <textarea
                  className={clsx(inputClass, 'resize-y min-h-[60px]')}
                  rows={3}
                  placeholder="Appendix content"
                  value={appx.content}
                  onChange={(e) => {
                    const next = [...appendices]
                    next[i] = { ...next[i], content: e.target.value }
                    setAppendices(next)
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Linked setups and diagrams</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Link setups from the Cases tab (plan setup links). Export embeds a diagram when the setup has an exported diagram file or photo.
        </p>
        {planSetups.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">No setups linked to this plan.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {planSetups.map((s: any) => (
              <li key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-blue-600 dark:text-blue-400 hover:underline text-left"
                  onClick={() => onOpenSetup?.(s)}
                >
                  {s.name || s.id}
                </button>
                {s.diagramExportPath ? (
                  <span className="text-xs text-green-600 dark:text-green-400">Diagram on file</span>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400">No diagram — configure on setup</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Revision control (export table)</h3>
        {revisions.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">No revision rows yet.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-600 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Rev</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Edited by</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Approved by</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400">Summary</th>
                  <th className="w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {revisions.map((r: any) => {
                  const isEditing = editingRevId === r.id
                  if (isEditing && editingRevData) {
                    return (
                      <tr key={r.id} className="bg-blue-50/50 dark:bg-blue-900/10">
                        <td className="px-2 py-1">
                          <input className={`${inputClass} !py-1 text-xs`} value={editingRevData.revisionNumber}
                            onChange={(e) => setEditingRevData({ ...editingRevData, revisionNumber: e.target.value })} />
                        </td>
                        <td className="px-2 py-1">
                          <input type="date" className={`${inputClass} !py-1 text-xs`} value={editingRevData.revisionDate}
                            onChange={(e) => setEditingRevData({ ...editingRevData, revisionDate: e.target.value })} />
                        </td>
                        <td className="px-2 py-1">
                          <input className={`${inputClass} !py-1 text-xs`} value={editingRevData.editedByName}
                            onChange={(e) => setEditingRevData({ ...editingRevData, editedByName: e.target.value })} />
                        </td>
                        <td className="px-2 py-1">
                          <input className={`${inputClass} !py-1 text-xs`} value={editingRevData.approvedByName}
                            onChange={(e) => setEditingRevData({ ...editingRevData, approvedByName: e.target.value })} />
                        </td>
                        <td className="px-2 py-1">
                          <input className={`${inputClass} !py-1 text-xs`} value={editingRevData.summaryOfChanges}
                            onChange={(e) => setEditingRevData({ ...editingRevData, summaryOfChanges: e.target.value })} />
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                              disabled={!editingRevData.revisionNumber.trim() || updateRevMutation.isPending}
                              onClick={() => updateRevMutation.mutate({
                                revisionId: r.id,
                                data: {
                                  revisionNumber: editingRevData.revisionNumber.trim(),
                                  revisionDate: editingRevData.revisionDate
                                    ? new Date(editingRevData.revisionDate + 'T12:00:00').toISOString()
                                    : null,
                                  editedByName: editingRevData.editedByName.trim() || null,
                                  approvedByName: editingRevData.approvedByName.trim() || null,
                                  summaryOfChanges: editingRevData.summaryOfChanges.trim() || null,
                                },
                              })}
                              aria-label="Save revision"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              className="p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              onClick={() => { setEditingRevId(null); setEditingRevData(null) }}
                              aria-label="Cancel edit"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={r.id}>
                      <td className="px-2 py-2 font-mono text-xs">{r.revisionNumber}</td>
                      <td className="px-2 py-2 text-xs text-gray-600 dark:text-gray-400">
                        {r.revisionDate ? format(new Date(r.revisionDate), 'yyyy-MM-dd') : '—'}
                      </td>
                      <td className="px-2 py-2 text-xs">{r.editedByName || '—'}</td>
                      <td className="px-2 py-2 text-xs">{r.approvedByName || '—'}</td>
                      <td className="px-2 py-2 text-xs max-w-[200px] truncate" title={r.summaryOfChanges}>
                        {r.summaryOfChanges || '—'}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            onClick={() => {
                              setEditingRevId(r.id)
                              setEditingRevData({
                                revisionNumber: r.revisionNumber ?? '',
                                revisionDate: toDateInput(r.revisionDate),
                                editedByName: r.editedByName ?? '',
                                approvedByName: r.approvedByName ?? '',
                                summaryOfChanges: r.summaryOfChanges ?? '',
                              })
                            }}
                            aria-label="Edit revision"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            onClick={() => deleteRevMutation.mutate(r.id)}
                            disabled={deleteRevMutation.isPending}
                            aria-label="Delete revision"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Add revision row</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <input className={inputClass} placeholder="Revision # *" value={newRev.revisionNumber} onChange={(e) => setNewRev({ ...newRev, revisionNumber: e.target.value })} />
            <input type="date" className={inputClass} value={newRev.revisionDate} onChange={(e) => setNewRev({ ...newRev, revisionDate: e.target.value })} />
            <input className={inputClass} placeholder="Edited by" value={newRev.editedByName} onChange={(e) => setNewRev({ ...newRev, editedByName: e.target.value })} />
            <input className={inputClass} placeholder="Approved by" value={newRev.approvedByName} onChange={(e) => setNewRev({ ...newRev, approvedByName: e.target.value })} />
            <input type="date" className={inputClass} value={newRev.approvedAt} onChange={(e) => setNewRev({ ...newRev, approvedAt: e.target.value })} />
            <input className={clsx(inputClass, 'sm:col-span-2 lg:col-span-3')} placeholder="Summary of changes" value={newRev.summaryOfChanges} onChange={(e) => setNewRev({ ...newRev, summaryOfChanges: e.target.value })} />
          </div>
          <button
            type="button"
            disabled={!newRev.revisionNumber.trim() || createRevMutation.isPending}
            onClick={() => createRevMutation.mutate()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg disabled:opacity-50"
          >
            <Plus size={16} />
            Add revision
          </button>
        </div>
      </section>

      {saveDocMutation.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">{(saveDocMutation.error as Error)?.message || 'Save failed'}</p>
      )}
      {createRevMutation.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">{(createRevMutation.error as Error)?.message || 'Could not add revision'}</p>
      )}
      {updateRevMutation.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">{(updateRevMutation.error as Error)?.message || 'Could not update revision'}</p>
      )}
    </div>
  )
}
