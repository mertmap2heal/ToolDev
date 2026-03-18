/**
 * UnitPicker
 * Searchable combobox for engineering units.
 * - Shows SI breakdown for derived units
 * - Warns when a custom (non-standard) unit is entered
 * - Suggests the closest standard unit when spelling looks like a full name
 */

import { useState, useRef, useEffect, useId } from 'react'
import { AlertTriangle, ChevronDown, Check } from 'lucide-react'
import {
  searchUnits,
  isKnownUnit,
  suggestUnit,
  getSIBreakdown,
  type UnitDef,
} from '../../config/units'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
}

export default function UnitPicker({ value, onChange, placeholder = '°C, Pa, m/s, kg…', disabled, id }: Props) {
  const inputId = useId()
  const resolvedId = id ?? inputId

  const [query, setQuery] = useState(value ?? '')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Keep local query in sync when value changes externally
  useEffect(() => { setQuery(value ?? '') }, [value])

  const results = searchUnits(query)
  const known = !query || isKnownUnit(query)
  const suggestion = !known ? suggestUnit(query) : null
  const breakdown = query ? getSIBreakdown(query) : null

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (unit: UnitDef) => {
    setQuery(unit.symbol)
    onChange(unit.symbol)
    setOpen(false)
    setHighlighted(0)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    onChange(v)
    setOpen(true)
    setHighlighted(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true)
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlighted(h => Math.min(h + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlighted(h => Math.max(h - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[highlighted]) handleSelect(results[highlighted])
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[highlighted] as HTMLElement | undefined
    item?.scrollIntoView?.({ block: 'nearest' })
  }, [highlighted])

  const categoryColor: Record<string, string> = {
    'SI Base':    '#3b82f6',
    'SI Derived': '#8b5cf6',
    'Imperial':   '#f59e0b',
    'Common':     '#22c55e',
    'Special':    '#6b7280',
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Input row */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          id={resolvedId}
          type="text"
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            paddingLeft: 10,
            paddingRight: 28,
            paddingTop: 6,
            paddingBottom: 6,
            border: `1px solid ${!known && query ? '#f59e0b' : 'var(--theme-border)'}`,
            borderRadius: 6,
            backgroundColor: 'var(--theme-bg)',
            color: 'var(--theme-text)',
            fontSize: 12,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <ChevronDown
          size={13}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--theme-text-muted)', pointerEvents: 'none',
          }}
        />
      </div>

      {/* SI breakdown hint (when known unit has a breakdown) */}
      {breakdown && known && query && (
        <div style={{ fontSize: 10, color: '#8b5cf6', marginTop: 3 }}>
          = {breakdown}
        </div>
      )}

      {/* Custom unit warning */}
      {!known && query && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginTop: 3 }}>
          <AlertTriangle size={11} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 10, color: '#92400e', lineHeight: 1.4 }}>
            <strong>Custom unit</strong> — not in standard library. Verify spelling.
            {suggestion && (
              <>
                {' '}Did you mean{' '}
                <button
                  type="button"
                  onClick={() => handleSelect(suggestion)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--theme-accent)', fontWeight: 600, fontSize: 10, padding: 0,
                  }}
                >
                  {suggestion.symbol} ({suggestion.name})
                </button>
                ?
              </>
            )}
          </div>
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 500,
            maxHeight: 260, overflowY: 'auto',
            border: '1px solid var(--theme-border)',
            borderRadius: 8,
            backgroundColor: 'var(--theme-surface)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            listStyle: 'none', margin: 0, padding: 4,
          }}
        >
          {results.map((unit, i) => (
            <li
              key={unit.symbol}
              role="option"
              aria-selected={i === highlighted}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(unit) }}
              onMouseEnter={() => setHighlighted(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 5, cursor: 'pointer',
                backgroundColor: i === highlighted ? 'var(--theme-sidebar-item-hover)' : 'transparent',
              }}
            >
              {/* Symbol */}
              <span style={{
                minWidth: 44, fontSize: 12, fontWeight: 700,
                color: 'var(--theme-text)', fontFamily: 'monospace',
              }}>
                {unit.symbol}
              </span>

              {/* Name + quantity */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--theme-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {unit.name}
                </div>
                {unit.siBreakdown && (
                  <div style={{ fontSize: 10, color: '#8b5cf6' }}>{unit.siBreakdown}</div>
                )}
              </div>

              {/* Category badge */}
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
                backgroundColor: `${categoryColor[unit.category] ?? '#6b7280'}18`,
                color: categoryColor[unit.category] ?? '#6b7280',
                flexShrink: 0,
              }}>
                {unit.category}
              </span>

              {/* Check for current value */}
              {unit.symbol === value && (
                <Check size={12} style={{ color: 'var(--theme-accent)', flexShrink: 0 }} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
