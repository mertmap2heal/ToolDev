/**
 * ============================================================================
 * CONTROL TOWER — SHARED UI PRIMITIVES
 * ============================================================================
 *
 * Tiny reusable pieces: badges, severity indicators, skeleton loaders,
 * section wrapper, mock-data banner.
 * ============================================================================
 */

import React from 'react'
import { AlertTriangle, Database, Info, Shield, XCircle } from 'lucide-react'
import type { LifecycleStatus, SeverityLevel } from '../types/contracts'

/* ── Status colour map ────────────────────────────────────────────────── */

const STATUS_COLOURS: Record<LifecycleStatus, { bg: string; text: string; dot: string }> = {
  Draft:        { bg: 'bg-gray-100 dark:bg-gray-700',   text: 'text-gray-700 dark:text-gray-300',   dot: 'bg-gray-400' },
  'In Review':  { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300',   dot: 'bg-blue-500' },
  Approved:     { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  Active:       { bg: 'bg-cyan-100 dark:bg-cyan-900/40', text: 'text-cyan-700 dark:text-cyan-300',   dot: 'bg-cyan-500' },
  'Under Change': { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  Deprecated:   { bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  Retired:      { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300',   dot: 'bg-rose-500' },
  Archived:     { bg: 'bg-slate-100 dark:bg-slate-700',  text: 'text-slate-600 dark:text-slate-300', dot: 'bg-slate-400' },
}

export function StatusBadge({ status }: { status: LifecycleStatus }) {
  const c = STATUS_COLOURS[status] ?? STATUS_COLOURS.Draft
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  )
}

export function getStatusColour(status: LifecycleStatus) {
  return STATUS_COLOURS[status] ?? STATUS_COLOURS.Draft
}

/* ── Severity indicator ───────────────────────────────────────────────── */

const SEVERITY_MAP: Record<SeverityLevel, { icon: React.ElementType; colour: string }> = {
  Critical: { icon: XCircle, colour: 'text-red-600 dark:text-red-400' },
  High:     { icon: AlertTriangle, colour: 'text-orange-500 dark:text-orange-400' },
  Medium:   { icon: Info, colour: 'text-amber-500 dark:text-amber-400' },
  Low:      { icon: Shield, colour: 'text-blue-500 dark:text-blue-400' },
  Info:     { icon: Info, colour: 'text-gray-400 dark:text-gray-500' },
}

export function SeverityIcon({ level, size = 16 }: { level: SeverityLevel; size?: number }) {
  const { icon: Icon, colour } = SEVERITY_MAP[level] ?? SEVERITY_MAP.Info
  return <Icon size={size} className={colour} />
}

/* ── Section wrapper (card) ───────────────────────────────────────────── */

export function Section({
  title,
  subtitle,
  icon: Icon,
  actions,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  icon?: React.ElementType
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={18} className="text-gray-500 dark:text-gray-400" />}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

/* ── Mock-data banner ─────────────────────────────────────────────────── */

export function MockDataBanner({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs font-medium">
      <Database size={14} />
      Displaying simulated data — backend not connected
    </div>
  )
}

/* ── Skeleton loader ──────────────────────────────────────────────────── */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <Skeleton className="h-3 w-20 mb-3" />
          <Skeleton className="h-7 w-16 mb-2" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      ))}
    </div>
  )
}

/* ── Progress bar ─────────────────────────────────────────────────────── */

export function ProgressBar({
  value,
  max = 100,
  colour = 'bg-blue-500',
  height = 'h-2',
}: {
  value: number
  max?: number
  colour?: string
  height?: string
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full ${height} overflow-hidden`}>
      <div className={`${colour} ${height} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ── Micro-sparkline (pure CSS) ───────────────────────────────────────── */

export function Sparkline({ values, colour = '#3b82f6' }: { values: number[]; colour?: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const h = 24
  const w = 80
  const step = w / (values.length - 1)
  const points = values.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="inline-block">
      <polyline fill="none" stroke={colour} strokeWidth="1.5" points={points} />
    </svg>
  )
}

/* ── Trend arrow ──────────────────────────────────────────────────────── */

export function TrendArrow({ value }: { value: number }) {
  if (value > 0) return <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">▲ {value.toFixed(1)}%</span>
  if (value < 0) return <span className="text-red-500 dark:text-red-400 text-xs font-medium">▼ {Math.abs(value).toFixed(1)}%</span>
  return <span className="text-gray-400 text-xs">—</span>
}
