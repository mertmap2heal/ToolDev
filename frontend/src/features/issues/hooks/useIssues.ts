import { useQuery } from '@tanstack/react-query'
import { fetchIssues } from '../api/mockData'
import type { AerospaceIssue } from '../types'

export interface UseIssuesResult {
  issues: AerospaceIssue[]
  isLoading: boolean
  error: Error | null
}

export function useIssues(): UseIssuesResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['issues', 'list'],
    queryFn: fetchIssues,
  })

  return {
    issues: data ?? [],
    isLoading,
    error: error instanceof Error ? error : null,
  }
}
