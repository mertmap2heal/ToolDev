import { useEffect, useMemo, useState } from 'react'
import { useParams, NavLink, Navigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { HELP_PAGES, getHelpPage } from './helpRegistry'

/**
 * Multi-page help / documentation layout.
 *
 * Layout: 240px sidebar (page list grouped by category) + main content
 * + 220px right rail (on-this-page anchor list — only on lg screens).
 *
 * Visual style follows the rest of the app: theme tokens for surface
 * + text, blue-600 accent, gray-200 / gray-700 borders. No serif
 * fonts and no warm palette so the page stays consistent with the
 * other modules.
 *
 * To add a page: edit `helpRegistry.ts`. The sidebar + routes pick it
 * up automatically.
 */

interface AnchorEntry {
  id: string
  label: string
  level: 2 | 3
}

export default function HelpLayout() {
  const { slug } = useParams<{ slug: string }>()
  const page = getHelpPage(slug)
  const [anchors, setAnchors] = useState<AnchorEntry[]>([])
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null)

  // Group sidebar entries
  const groups = useMemo(() => {
    const map = new Map<string, typeof HELP_PAGES>()
    for (const p of HELP_PAGES) {
      if (p.hidden) continue
      const g = p.group ?? 'Other'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(p)
    }
    return Array.from(map.entries())
  }, [])

  // Read anchors from rendered headings whenever the page changes.
  useEffect(() => {
    if (!page) return
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>('article[data-help-content] h2[id], article[data-help-content] h3[id]'),
    )
    setAnchors(
      headings.map((h) => ({
        id: h.id,
        label: h.textContent?.trim() ?? '',
        level: h.tagName === 'H2' ? 2 : 3,
      })),
    )
    setActiveAnchor(headings[0]?.id ?? null)
  }, [page])

  // Highlight the heading closest to the top of the viewport.
  useEffect(() => {
    if (anchors.length === 0) return
    const recompute = () => {
      const threshold = 120
      let current = anchors[0].id
      for (const a of anchors) {
        const el = document.getElementById(a.id)
        if (!el) continue
        const top = el.getBoundingClientRect().top
        if (top - threshold <= 0) current = a.id
        else break
      }
      setActiveAnchor((prev) => (prev === current ? prev : current))
    }
    recompute()
    document.addEventListener('scroll', recompute, true)
    window.addEventListener('resize', recompute)
    return () => {
      document.removeEventListener('scroll', recompute, true)
      window.removeEventListener('resize', recompute)
    }
  }, [anchors])

  // Default route → first non-hidden page
  if (!slug) {
    const first = HELP_PAGES.find((p) => !p.hidden)
    return <Navigate to={`/help/${first?.slug ?? 'overview'}`} replace />
  }
  if (!page) {
    return <Navigate to="/help" replace />
  }

  const Body = page.Component

  return (
    <div
      className="min-h-screen text-[var(--theme-text)]"
      style={{ backgroundColor: 'var(--theme-bg)' }}
    >
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-8">
        {/* Breadcrumb */}
        <nav className="text-xs text-[var(--theme-text-muted)] mb-6 flex items-center gap-1.5">
          <span>Documentation</span>
          <ChevronRight size={12} />
          <span className="text-[var(--theme-text)]">{page.label}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_220px] gap-8">
          {/* Sidebar — page list */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              {groups.map(([groupName, pages]) => (
                <div key={groupName} className="mb-6">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--theme-text-muted)] mb-2 font-semibold px-2">
                    {groupName}
                  </p>
                  <ul className="space-y-0.5">
                    {pages.map((p) => (
                      <li key={p.slug}>
                        <NavLink
                          to={`/help/${p.slug}`}
                          className={({ isActive }) =>
                            `flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                              isActive
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`
                          }
                        >
                          <p.icon size={14} strokeWidth={1.75} />
                          <span className="truncate">{p.label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0">
            <header className="border-b border-gray-200 dark:border-gray-800 pb-6 mb-8">
              <h1 className="text-3xl font-semibold text-[var(--theme-text)] mb-2">
                {page.title}
              </h1>
              <p className="text-sm text-[var(--theme-text-muted)] leading-relaxed max-w-3xl">
                {page.blurb}
              </p>
            </header>

            <article
              data-help-content
              className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-h2:text-xl prose-h2:mt-12 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-200 dark:prose-h2:border-gray-800 prose-h3:text-base prose-h3:mt-8 prose-h3:mb-2 prose-p:leading-relaxed prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline prose-code:text-blue-600 dark:prose-code:text-blue-400 prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:font-medium prose-code:before:content-none prose-code:after:content-none prose-strong:text-gray-900 dark:prose-strong:text-white"
            >
              <Body />
            </article>
          </main>

          {/* Right rail — On this page */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              {anchors.length > 0 && (
                <>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--theme-text-muted)] mb-2 font-semibold">
                    On this page
                  </p>
                  <ul className="space-y-0.5">
                    {anchors.map((a) => (
                      <li key={a.id}>
                        <a
                          href={`#${a.id}`}
                          className={`block py-1 text-xs rounded-md transition-colors ${
                            a.level === 3 ? 'pl-5' : 'pl-2'
                          } pr-2 ${
                            activeAnchor === a.id
                              ? 'text-blue-700 dark:text-blue-300 font-medium border-l-2 border-blue-600 dark:border-blue-400 -ml-px'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border-l-2 border-transparent -ml-px'
                          }`}
                        >
                          {a.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
