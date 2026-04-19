import { useState, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Plus, Trash2, BarChart3 } from 'lucide-react'
import {
  MOCK_MARKOV_STATES,
  MOCK_MARKOV_TRANSITIONS,
} from '../../data/mockSafety'
import type { MarkovState, MarkovTransition, MarkovStateTag } from '../../types/safety.types'

const TAG_OPTIONS: MarkovStateTag[] = ['safe', 'degraded', 'failed']

function MarkovStateEditor({
  states,
  onAdd,
  onUpdate,
  onDelete,
}: {
  states: MarkovState[]
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<MarkovState>) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">State editor</h3>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Plus size={14} /> Add
        </button>
      </div>
      <ul className="space-y-2">
        {states.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <input
              value={s.name}
              onChange={(e) => onUpdate(s.id, { name: e.target.value })}
              placeholder="Name"
              className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            />
            <input
              value={s.description ?? ''}
              onChange={(e) => onUpdate(s.id, { description: e.target.value })}
              placeholder="Description"
              className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            />
            <select
              value={s.tag}
              onChange={(e) => onUpdate(s.id, { tag: e.target.value as MarkovStateTag })}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
            >
              {TAG_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onDelete(s.id)}
              className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MarkovTransitionEditor({
  transitions,
  states,
  onAdd,
  onUpdate,
  onDelete,
}: {
  transitions: MarkovTransition[]
  states: MarkovState[]
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<MarkovTransition>) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Transition editor</h3>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Plus size={14} /> Add
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">From</th>
              <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">To</th>
              <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Label</th>
              <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">Rate / probability</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {transitions.map((t) => (
              <tr key={t.id} className="border-t border-gray-200 dark:border-gray-700">
                <td className="py-1 px-3">
                  <select
                    value={t.fromStateId}
                    onChange={(e) => onUpdate(t.id, { fromStateId: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  >
                    {states.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1 px-3">
                  <select
                    value={t.toStateId}
                    onChange={(e) => onUpdate(t.id, { toStateId: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  >
                    {states.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1 px-3">
                  <input
                    value={t.label}
                    onChange={(e) => onUpdate(t.id, { label: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 px-3">
                  <input
                    value={t.rateOrProbability ?? ''}
                    onChange={(e) => onUpdate(t.id, { rateOrProbability: e.target.value })}
                    placeholder="Placeholder"
                    className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                  />
                </td>
                <td className="py-1 px-1">
                  <button
                    type="button"
                    onClick={() => onDelete(t.id)}
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MarkovModelView({ states, transitions }: { states: MarkovState[]; transitions: MarkovTransition[] }) {
  const nodeMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    const n = states.length
    const r = 120
    states.forEach((s, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2
      m.set(s.id, { x: 200 + r * Math.cos(angle), y: 150 + r * Math.sin(angle) })
    })
    return m
  }, [states])

  const nodes: Node[] = useMemo(
    () =>
      states.map((s) => ({
        id: s.id,
        type: 'default',
        position: nodeMap.get(s.id) ?? { x: 0, y: 0 },
        data: { label: `${s.name} (${s.tag})` },
        style: {
          padding: '8px 12px',
          borderRadius: 8,
          borderWidth: 2,
          borderColor:
            s.tag === 'safe' ? '#22c55e' : s.tag === 'degraded' ? '#eab308' : '#ef4444',
        },
      })),
    [states, nodeMap]
  )

  const edges: Edge[] = useMemo(
    () =>
      transitions.map((t) => ({
        id: t.id,
        source: t.fromStateId,
        target: t.toStateId,
        type: 'smoothstep',
        label: t.label,
        markerEnd: { type: MarkerType.ArrowClosed },
      })),
    [transitions]
  )

  const [nodesState, setNodesState, onNodesChange] = useNodesState(nodes)
  const [edgesState, setEdgesState, onEdgesChange] = useEdgesState(edges)

  return (
    <div className="h-[320px] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900">
      <ReactFlow
        nodes={nodesState}
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  )
}

export default function MarkovPage() {
  const [states, setStates] = useState<MarkovState[]>(MOCK_MARKOV_STATES)
  const [transitions, setTransitions] = useState<MarkovTransition[]>(MOCK_MARKOV_TRANSITIONS)

  const handleAddState = () => {
    const id = `s${Date.now()}`
    setStates((prev) => [...prev, { id, name: 'New state', description: '', tag: 'degraded' }])
  }

  const handleUpdateState = (id: string, patch: Partial<MarkovState>) => {
    setStates((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    )
  }

  const handleDeleteState = (id: string) => {
    setStates((prev) => prev.filter((s) => s.id !== id))
    setTransitions((prev) =>
      prev.filter((t) => t.fromStateId !== id && t.toStateId !== id)
    )
  }

  const handleAddTransition = () => {
    const from = states[0]?.id ?? ''
    const to = states[1]?.id ?? from
    setTransitions((prev) => [
      ...prev,
      { id: `t${Date.now()}`, fromStateId: from, toStateId: to, label: '' },
    ])
  }

  const handleUpdateTransition = (id: string, patch: Partial<MarkovTransition>) => {
    setTransitions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    )
  }

  const handleDeleteTransition = (id: string) => {
    setTransitions((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Markov model
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          State and transition editors, model view. No solver; results placeholder.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <MarkovStateEditor
            states={states}
            onAdd={handleAddState}
            onUpdate={handleUpdateState}
            onDelete={handleDeleteState}
          />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <MarkovTransitionEditor
            transitions={transitions}
            states={states}
            onAdd={handleAddTransition}
            onUpdate={handleUpdateTransition}
            onDelete={handleDeleteTransition}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Model view</h3>
        <ReactFlowProvider>
          <MarkovModelView states={states} transitions={transitions} />
        </ReactFlowProvider>
      </div>

      {/*
        #275: pre-fix this card rendered hardcoded 0.9999 / 1e-6 values
        that could be screenshot-ed into a report and presented as
        compliant-looking safety metrics. FAR/CS 25.1309 uses these
        exact thresholds, so a fake number on screen is actively
        dangerous. Replace the numeric cells with em-dashes and a clear
        "solver not implemented" status line until a real Markov solver
        ships in the backend.
      */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <BarChart3 size={16} />
          Results
        </h3>
        <p className="text-sm text-amber-700 dark:text-amber-400 mb-4">
          Not available — Markov solver is not implemented. Do not quote these
          cells in any safety evidence; they are intentionally blank.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div className="text-xs text-gray-500 dark:text-gray-400">Availability</div>
            <div className="text-lg font-semibold text-gray-400 dark:text-gray-500">—</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div className="text-xs text-gray-500 dark:text-gray-400">Failure probability</div>
            <div className="text-lg font-semibold text-gray-400 dark:text-gray-500">—</div>
          </div>
        </div>
      </div>
    </div>
  )
}
