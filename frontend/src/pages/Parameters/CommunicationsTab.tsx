/**
 * Communications Tab — three-panel layout:
 *   Bus list | Message list | Field editor
 *
 * Supports protocols: CAN, ROS, DDS, XTCE, MAVLink, AUTOSAR, MQTT, custom.
 * Fields can be linked to project Parameters.
 */
import { useState } from 'react'
import { Plus, Trash2, Edit2, ChevronRight, X, Save, GripVertical, Link2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commService } from '../../services/comm.service'
import { parameterService } from '../../services/parameter.service'
import type { CommBus, CommMessage, CommField } from 'shared/types/engineering.types'

// ── constants ────────────────────────────────────────────────────────────────

const PROTOCOLS = [
  { key: 'can',      label: 'CAN / DBC' },
  { key: 'ros',      label: 'ROS / ROS2 (topics)' },
  { key: 'dds',      label: 'DDS / RTPS' },
  { key: 'xtce',     label: 'XTCE' },
  { key: 'mavlink',  label: 'MAVLink' },
  { key: 'autosar',  label: 'AUTOSAR' },
  { key: 'mqtt',     label: 'MQTT' },
  { key: 'custom',   label: 'Custom' },
] as const

const DIRECTIONS = ['publish', 'subscribe', 'send', 'receive', 'bidirectional'] as const

const PROTOCOL_COLOR: Record<string, string> = {
  can: '#f59e0b', ros: '#22c55e', dds: '#3b82f6', xtce: '#8b5cf6',
  mavlink: '#ef4444', autosar: '#06b6d4', mqtt: '#f97316', custom: '#6b7280',
}

const INPUT = 'w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const SELECT = INPUT
const BTN_SM = 'flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors'

// ── Bus panel ─────────────────────────────────────────────────────────────────

function BusPanel({
  projectId,
  selectedBusId,
  onSelect,
}: {
  projectId: string
  selectedBusId: string | null
  onSelect: (id: string | null) => void
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<CommBus | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', protocol: 'can', description: '' })

  const { data: buses = [], isLoading } = useQuery({
    queryKey: ['comm-buses', projectId],
    queryFn: () => commService.getBuses(projectId),
  })

  const createMut = useMutation({
    mutationFn: () => commService.createBus(projectId, { name: form.name.trim(), protocol: form.protocol, description: form.description.trim() || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comm-buses', projectId] }); setCreating(false); setForm({ name: '', protocol: 'can', description: '' }) },
  })

  const updateMut = useMutation({
    mutationFn: (b: CommBus) => commService.updateBus(projectId, b.id, { name: form.name.trim(), protocol: form.protocol, description: form.description.trim() || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comm-buses', projectId] }); setEditing(null) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => commService.deleteBus(projectId, id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['comm-buses', projectId] })
      if (selectedBusId === id) onSelect(null)
    },
  })

  function startEdit(b: CommBus) {
    setEditing(b)
    setForm({ name: b.name, protocol: b.protocol, description: b.description ?? '' })
    setCreating(false)
  }

  function startCreate() {
    setCreating(true)
    setEditing(null)
    setForm({ name: '', protocol: 'can', description: '' })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Buses</span>
        <button onClick={startCreate} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="New bus">
          <Plus className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Inline create / edit form */}
      {(creating || editing) && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2 bg-blue-50 dark:bg-blue-950/20">
          <input className={INPUT} placeholder="Bus name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
          <select className={SELECT} value={form.protocol} onChange={e => setForm(p => ({ ...p, protocol: e.target.value }))}>
            {PROTOCOLS.map(pr => <option key={pr.key} value={pr.key}>{pr.label}</option>)}
          </select>
          <input className={INPUT} placeholder="Description (optional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <div className="flex gap-2">
            <button
              onClick={() => editing ? updateMut.mutate(editing) : createMut.mutate()}
              disabled={!form.name.trim() || createMut.isPending || updateMut.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {editing ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setCreating(false); setEditing(null) }} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="text-xs text-gray-400 p-3">Loading…</p>}
        {!isLoading && buses.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 p-3">No buses yet. Create one to start.</p>
        )}
        {buses.map(bus => (
          <div
            key={bus.id}
            onClick={() => onSelect(bus.id)}
            className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 transition-colors ${selectedBusId === bus.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: PROTOCOL_COLOR[bus.protocol] ?? '#6b7280' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{bus.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{PROTOCOLS.find(p => p.key === bus.protocol)?.label ?? bus.protocol} · {bus._count?.messages ?? 0} messages</p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={e => { e.stopPropagation(); startEdit(bus) }}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5 text-gray-500" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); if (confirm(`Delete bus "${bus.name}"?`)) deleteMut.mutate(bus.id) }}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
            {selectedBusId === bus.id && <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Message panel ─────────────────────────────────────────────────────────────

function MessagePanel({
  projectId,
  busId,
  selectedMessageId,
  onSelect,
}: {
  projectId: string
  busId: string
  selectedMessageId: string | null
  onSelect: (id: string | null) => void
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<CommMessage | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', messageId: '', direction: '', description: '' })

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['comm-messages', projectId, busId],
    queryFn: () => commService.getMessages(projectId, busId),
  })

  const createMut = useMutation({
    mutationFn: () => commService.createMessage(projectId, busId, {
      name: form.name.trim(),
      messageId: form.messageId.trim() || undefined,
      direction: form.direction || undefined,
      description: form.description.trim() || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comm-messages', projectId, busId] }); setCreating(false); setForm({ name: '', messageId: '', direction: '', description: '' }) },
  })

  const updateMut = useMutation({
    mutationFn: (m: CommMessage) => commService.updateMessage(projectId, m.id, {
      name: form.name.trim(),
      messageId: form.messageId.trim() || null,
      direction: form.direction || null,
      description: form.description.trim() || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comm-messages', projectId, busId] }); setEditing(null) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => commService.deleteMessage(projectId, id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['comm-messages', projectId, busId] })
      if (selectedMessageId === id) onSelect(null)
    },
  })

  function startEdit(m: CommMessage) {
    setEditing(m)
    setForm({ name: m.name, messageId: m.messageId ?? '', direction: m.direction ?? '', description: m.description ?? '' })
    setCreating(false)
  }

  function startCreate() {
    setCreating(true)
    setEditing(null)
    setForm({ name: '', messageId: '', direction: '', description: '' })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Messages</span>
        <button onClick={startCreate} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="New message">
          <Plus className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {(creating || editing) && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2 bg-blue-50 dark:bg-blue-950/20">
          <input className={INPUT} placeholder="Message name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
          <input className={INPUT} placeholder="ID / PGN / topic (optional)" value={form.messageId} onChange={e => setForm(p => ({ ...p, messageId: e.target.value }))} />
          <select className={SELECT} value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}>
            <option value="">Direction (optional)</option>
            {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input className={INPUT} placeholder="Description (optional)" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <div className="flex gap-2">
            <button
              onClick={() => editing ? updateMut.mutate(editing) : createMut.mutate()}
              disabled={!form.name.trim() || createMut.isPending || updateMut.isPending}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              {editing ? 'Update' : 'Create'}
            </button>
            <button onClick={() => { setCreating(false); setEditing(null) }} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="text-xs text-gray-400 p-3">Loading…</p>}
        {!isLoading && messages.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 p-3">No messages yet.</p>
        )}
        {messages.map(msg => (
          <div
            key={msg.id}
            onClick={() => onSelect(msg.id)}
            className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-gray-100 dark:border-gray-700/50 transition-colors ${selectedMessageId === msg.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{msg.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {msg.messageId && <span className="font-mono mr-1">{msg.messageId}</span>}
                {msg.direction && <span className="capitalize">{msg.direction}</span>}
                {!msg.messageId && !msg.direction && <span>{msg._count?.fields ?? 0} fields</span>}
              </p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={e => { e.stopPropagation(); startEdit(msg) }} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="Edit">
                <Edit2 className="w-3.5 h-3.5 text-gray-500" />
              </button>
              <button onClick={e => { e.stopPropagation(); if (confirm(`Delete message "${msg.name}"?`)) deleteMut.mutate(msg.id) }} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30" title="Delete">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
            {selectedMessageId === msg.id && <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Field editor ──────────────────────────────────────────────────────────────

function FieldEditor({
  messageId,
  projectId,
}: {
  messageId: string
  projectId: string
}) {
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const blank = { fieldName: '', dataType: '', parameterId: '', description: '' }
  const [form, setForm] = useState(blank)

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['comm-fields', projectId, messageId],
    queryFn: () => commService.getFields(projectId, messageId),
  })

  const { data: parametersRes } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: () => parameterService.getParameters(projectId).then(r => r.data ?? []),
    staleTime: 60_000,
  })
  const parameters = parametersRes ?? []

  const createMut = useMutation({
    mutationFn: () => commService.createField(projectId, messageId, {
      fieldName: form.fieldName.trim(),
      dataType: form.dataType.trim() || undefined,
      parameterId: form.parameterId || null,
      description: form.description.trim() || undefined,
      order: fields.length,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comm-fields', projectId, messageId] }); setCreating(false); setForm(blank) },
  })

  const updateMut = useMutation({
    mutationFn: (id: string) => commService.updateField(projectId, id, {
      fieldName: form.fieldName.trim(),
      dataType: form.dataType.trim() || null,
      parameterId: form.parameterId || null,
      description: form.description.trim() || null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comm-fields', projectId, messageId] }); setEditingId(null) },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => commService.deleteField(projectId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comm-fields', projectId, messageId] }),
  })

  function startEdit(f: CommField) {
    setEditingId(f.id)
    setForm({ fieldName: f.fieldName, dataType: f.dataType ?? '', parameterId: f.parameterId ?? '', description: f.description ?? '' })
    setCreating(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Fields / Signals</span>
        <button
          onClick={() => { setCreating(true); setEditingId(null); setForm(blank) }}
          className={`${BTN_SM} bg-blue-600 text-white border-blue-600 hover:bg-blue-700`}
        >
          <Plus className="w-3.5 h-3.5" />
          Add field
        </button>
      </div>

      {/* Inline create form */}
      {creating && (
        <FieldForm
          form={form}
          setForm={setForm}
          parameters={parameters}
          onSave={() => createMut.mutate()}
          onCancel={() => setCreating(false)}
          saving={createMut.isPending}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="text-xs text-gray-400 p-4">Loading…</p>}
        {!isLoading && fields.length === 0 && !creating && (
          <p className="text-xs text-gray-400 dark:text-gray-500 p-4">No fields defined. Add a signal/field to this message.</p>
        )}
        {fields.map((field, idx) => (
          <div key={field.id} className="border-b border-gray-100 dark:border-gray-700/50">
            {editingId === field.id ? (
              <FieldForm
                form={form}
                setForm={setForm}
                parameters={parameters}
                onSave={() => updateMut.mutate(field.id)}
                onCancel={() => setEditingId(null)}
                saving={updateMut.isPending}
              />
            ) : (
              <div className="group flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                <span className="text-xs text-gray-400 dark:text-gray-500 font-mono pt-0.5 select-none w-5 text-right flex-shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">{field.fieldName}</span>
                    {field.dataType && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-mono">{field.dataType}</span>
                    )}
                    {field.parameter && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                        <Link2 className="w-3 h-3" />
                        {field.parameter.name}
                      </span>
                    )}
                  </div>
                  {field.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{field.description}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => startEdit(field)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="Edit">
                    <Edit2 className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <button onClick={() => { if (confirm(`Delete field "${field.fieldName}"?`)) deleteMut.mutate(field.id) }} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30" title="Delete">
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FieldForm({
  form,
  setForm,
  parameters,
  onSave,
  onCancel,
  saving,
}: {
  form: { fieldName: string; dataType: string; parameterId: string; description: string }
  setForm: React.Dispatch<React.SetStateAction<typeof form>>
  parameters: { id: string; name: string; dataType?: string }[]
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Field name *</label>
          <input className={INPUT} placeholder="e.g. engine_speed" value={form.fieldName} onChange={e => setForm(p => ({ ...p, fieldName: e.target.value }))} autoFocus />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Data type</label>
          <input className={INPUT} placeholder="e.g. uint16, float32" value={form.dataType} onChange={e => setForm(p => ({ ...p, dataType: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Linked parameter (optional)</label>
        <select className={SELECT} value={form.parameterId} onChange={e => setForm(p => ({ ...p, parameterId: e.target.value }))}>
          <option value="">— None —</option>
          {parameters.map(p => (
            <option key={p.id} value={p.id}>{p.name}{p.dataType ? ` (${p.dataType})` : ''}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
        <input className={INPUT} placeholder="Optional description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onSave} disabled={!form.fieldName.trim() || saving} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors">
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── CommunicationsTab (root) ──────────────────────────────────────────────────

export default function CommunicationsTab({ projectId }: { projectId: string }) {
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)

  function handleSelectBus(id: string | null) {
    setSelectedBusId(id)
    setSelectedMessageId(null)
  }

  return (
    <div
      className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 h-[520px]"
    >
      {/* Bus list */}
      <div className="w-60 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <BusPanel projectId={projectId} selectedBusId={selectedBusId} onSelect={handleSelectBus} />
      </div>

      {/* Message list */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {selectedBusId ? (
          <MessagePanel projectId={projectId} busId={selectedBusId} selectedMessageId={selectedMessageId} onSelect={setSelectedMessageId} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-4">Select a bus to view its messages</p>
          </div>
        )}
      </div>

      {/* Field editor */}
      <div className="flex-1 bg-white dark:bg-gray-800">
        {selectedMessageId ? (
          <FieldEditor messageId={selectedMessageId} projectId={projectId} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-4">
              {selectedBusId ? 'Select a message to edit its fields' : 'Select a bus, then a message to edit fields'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
