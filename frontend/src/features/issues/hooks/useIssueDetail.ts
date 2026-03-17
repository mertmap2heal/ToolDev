import { useQuery } from '@tanstack/react-query'
import { fetchIssueById } from '../api/mockData'
import type { AerospaceIssue } from '../types'

export interface UseIssueDetailResult {
  issue: AerospaceIssue | null
  isLoading: boolean
  error: Error | null
}

export function useIssueDetail(issueId: string | undefined): UseIssueDetailResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['issues', 'detail', issueId],
    queryFn: () => (issueId ? fetchIssueById(issueId) : Promise.resolve(null)),
    enabled: !!issueId,
  })

  return {
    issue: data ?? null,
    isLoading,
    error: error instanceof Error ? error : null,
  }
}
