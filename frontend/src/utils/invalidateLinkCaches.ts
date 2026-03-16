import type { QueryClient } from '@tanstack/react-query'

/**
 * Centralized cache invalidation for all link-related React Query caches.
 *
 * Every component that creates, updates, or deletes a traceability/linkage
 * relationship MUST call this function in its onSuccess handler. This ensures
 * a single source of truth: any view that displays link data will refresh.
 *
 * Prefix-based invalidation is used so that granular keys like
 * ['requirement-links', projectId, reqId] are also caught by the broader
 * ['requirement-links', projectId] invalidation.
 */
export function invalidateLinkCaches(
  queryClient: QueryClient,
  projectId: string
): void {
  // Primary link data stores
  queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
  queryClient.invalidateQueries({ queryKey: ['links', projectId] })
  queryClient.invalidateQueries({ queryKey: ['traceability', projectId] })

  // Requirement-specific link views (detail drawer, functions tree)
  queryClient.invalidateQueries({ queryKey: ['requirement-links', projectId] })
  queryClient.invalidateQueries({ queryKey: ['requirement-links-out', projectId] })
  queryClient.invalidateQueries({ queryKey: ['requirement-links-in', projectId] })
  queryClient.invalidateQueries({ queryKey: ['incoming-links', projectId] })

  // Function-specific link views
  queryClient.invalidateQueries({ queryKey: ['function-trace-links-outgoing', projectId] })
  queryClient.invalidateQueries({ queryKey: ['function-trace-links-incoming', projectId] })

  // Linkage targets (LINKAGE_V1)
  queryClient.invalidateQueries({ queryKey: ['linkage-targets', projectId] })

  // Document-level trace links
  queryClient.invalidateQueries({ queryKey: ['document-trace-links'] })

  // Issue link caches
  queryClient.invalidateQueries({ queryKey: ['issue-incoming-links', projectId] })
}
