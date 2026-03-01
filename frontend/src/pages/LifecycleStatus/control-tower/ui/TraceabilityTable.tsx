/**
 * ============================================================================
 * CONTROL TOWER — TRACEABILITY TABLE
 * ============================================================================
 *
 * Sortable, searchable table of lifecycle traceability rows.
 * Columns: ID · Name · Type · Status · Parent · Children · Coverage %
 *
 * This is the "Digital Thread" view — every entity with its linkage context.
 * Aviation: ARP4754A §5.3 requires bi-directional traceability.
 * ============================================================================
 */

import React, { useMemo, useState } from 'react'
import { Link2, Search, ChevronUp, ChevronDown } from 'lucide-react'
import type { TraceabilityRow } from '../types/contracts'
import { Section, StatusBadge, ProgressBar, Skeleton } from './Primitives'

interface Props {
  rows: TraceabilityRow[] | undefined
  isLoading: boolean
}

type SortField = 'entityId' | 'entityName' | 'entityType' | 'currentStatus' | 'coveragePercent'
type SortDir = 'asc' | 'desc'

export function TraceabilityTable({ rows, isLoading }: Props) {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<SortField>('entityId')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const filtered = useMemo(() => {
    if (!rows) return []
    let result = rows
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.entityId.toLowerCase().includes(q) ||
          r.entityName.toLowerCase().includes(q) ||
          r.entityType.toLowerCase().includes(q) ||
          r.currentStatus.toLowerCase().includes(q)
      )
    }
    result = [...result].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const cmp = typeof aVal === 'number' ? (aVal as number) - (bVal as number) : String(aVal).localeCompare(String(bVal))
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [rows, search, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronUp size={12} className="text-gray-300 dark:text-gray-600" />
    return sortDir === 'asc' ? (
      <ChevronUp size={12} className="text-blue-500" />
    ) : (
      <ChevronDown size={12} className="text-blue-500" />
    )
  }

  if (isLoading || !rows) {
    return (
      <Section title="Traceability Thread" icon={Link2}>
        <Skeleton className="h-64 w-full" />
      </Section>
    )
  }

  return (
    <Section
      title="Traceability Thread"
      subtitle={`${rows.length} entities · ARP4754A §5.3 bi-directional linkage`}
      icon={Link2}
      actions={
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities…"
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none w-56"
          />
        </div>
      }
    >
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {([
                ['entityId', 'ID'],
                ['entityName', 'Name'],
                ['entityType', 'Type'],
                ['currentStatus', 'Status'],
                ['coveragePercent', 'Coverage'],
              ] as [SortField, string][]).map(([field, label]) => (
                <th
                  key={field}
                  onClick={() => toggleSort(field)}
                  className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <SortIcon field={field} />
                  </span>
                </th>
              ))}
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Parent</th>
              <th className="text-left py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Children</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((row) => (
              <tr key={row.entityId} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="py-2 px-2 font-mono text-gray-600 dark:text-gray-400">{row.entityId}</td>
                <td className="py-2 px-2 text-gray-900 dark:text-white max-w-[200px] truncate">{row.entityName}</td>
                <td className="py-2 px-2 text-gray-500 dark:text-gray-400">{row.entityType}</td>
                <td className="py-2 px-2"><StatusBadge status={row.currentStatus} /></td>
                <td className="py-2 px-2 w-32">
                  <div className="flex items-center gap-2">
                    <ProgressBar
                      value={row.coveragePercent}
                      colour={row.coveragePercent >= 80 ? 'bg-emerald-500' : row.coveragePercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}
                      height="h-1.5"
                    />
                    <span className="text-gray-500 dark:text-gray-400 w-8 text-right">{row.coveragePercent}%</span>
                  </div>
                </td>
                <td className="py-2 px-2 font-mono text-gray-500 dark:text-gray-400 text-[10px]">
                  {row.parentId ?? '—'}
                </td>
                <td className="py-2 px-2 text-gray-500 dark:text-gray-400">
                  {row.childrenIds.length > 0 ? row.childrenIds.length : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">No entities match "{search}"</div>
        )}
        {filtered.length > 200 && (
          <div className="text-center py-3 text-gray-400 text-xs">
            Showing 200 of {filtered.length} — refine your search
          </div>
        )}
      </div>
    </Section>
  )
}
