import { loadPBS } from '../../modules/pbs/storage'
import type { EntityRef, EntitySummary } from 'shared/types/linkage.types'

function filterNodes(nodes: { id: string; name: string; pbsCode?: string }[], query: string) {
  const q = query.toLowerCase().trim()
  if (!q) return nodes
  return nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(q) ||
      (n.pbsCode && n.pbsCode.toLowerCase().includes(q)) ||
      n.id.toLowerCase().includes(q)
  )
}

export const pbsAdapter = {
  async search(query: string, projectId: string): Promise<EntitySummary[]> {
    const data = loadPBS(projectId)
    const filtered = filterNodes(data.nodes, query)
    return filtered.slice(0, 50).map((n) => ({
      id: n.id,
      type: 'pbs_component' as const,
      label: `${n.pbsCode || n.id} - ${n.name}`,
      description: (n as { description?: string }).description,
    }))
  },

  async getById(id: string, projectId: string): Promise<EntitySummary | null> {
    const data = loadPBS(projectId)
    const node = data.nodes.find((n) => n.id === id)
    if (!node) return null
    return {
      id: node.id,
      type: 'pbs_component',
      label: `${node.pbsCode || node.id} - ${node.name}`,
      description: node.description,
    }
  },

  buildDeepLink(projectId: string, ref: EntityRef): string {
    return `/projects/${projectId}/product-breakdown-structure?focusType=pbs_component&focusId=${ref.id}`
  },
}
