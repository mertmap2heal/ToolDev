import { Link } from 'react-router-dom'
import { HELP_PAGES } from '../helpRegistry'

export default function OverviewSection() {
  return (
    <>
      <p>
        This is the in-app reference for the Engineering Project Development Tool. Each
        module has its own page covering the page layout, common workflows, keyboard
        shortcuts, and (where relevant) the REST + MCP API surface that powers it.
      </p>
      <p>
        The sidebar lists every documented page. Pick a module on the left to dive in,
        or use the quick links below.
      </p>

      <h2 id="modules">Modules</h2>
      <p>
        Each module documents the views, controls, and data model exposed by that part
        of the app.
      </p>
      <ul className="not-prose mt-3 grid gap-2 sm:grid-cols-2">
        {HELP_PAGES.filter((p) => p.group === 'Modules' && !p.hidden).map((p) => (
          <li key={p.slug}>
            <Link
              to={`/help/${p.slug}`}
              className="block rounded-md border border-gray-200 dark:border-gray-800 p-3 hover:border-blue-500 dark:hover:border-blue-500 transition-colors group"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                <p.icon size={15} strokeWidth={1.75} className="text-blue-600 dark:text-blue-400" />
                {p.label}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {p.blurb}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <h2 id="platform">Platform</h2>
      <p>
        Cross-cutting features that apply across modules — AI assistance, security
        controls, and integrations.
      </p>
      <ul className="not-prose mt-3 grid gap-2 sm:grid-cols-2">
        {HELP_PAGES.filter((p) => p.group === 'Platform' && !p.hidden).map((p) => (
          <li key={p.slug}>
            <Link
              to={`/help/${p.slug}`}
              className="block rounded-md border border-gray-200 dark:border-gray-800 p-3 hover:border-blue-500 dark:hover:border-blue-500 transition-colors group"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                <p.icon size={15} strokeWidth={1.75} className="text-blue-600 dark:text-blue-400" />
                {p.label}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                {p.blurb}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <h2 id="contributing">Contributing</h2>
      <p>
        Pages are React components under{' '}
        <code>frontend/src/pages/Help/sections/</code>. Add a new section by creating
        the component, then registering it in{' '}
        <code>frontend/src/pages/Help/helpRegistry.ts</code>. The sidebar and the route
        table both pick it up — no other wiring required.
      </p>
    </>
  )
}
