import { apiClient } from './api'

export interface ScenarioOverride {
  id: string
  scenarioId: string
  parameterId: string
  value: string
  createdAt: string
}

export interface ScenarioSummary {
  id: string
  projectId: string
  name: string
  description: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  overrideCount: number
}

export interface Scenario extends ScenarioSummary {
  overrides: ScenarioOverride[]
}

export const parameterScenarioService = {
  list: (projectId: string) =>
    apiClient.get<ScenarioSummary[]>(`/parameters/${projectId}/scenarios`),

  get: (projectId: string, scenarioId: string) =>
    apiClient.get<Scenario>(`/parameters/${projectId}/scenarios/${scenarioId}`),

  create: (
    projectId: string,
    body: {
      name: string
      description?: string
      overrides?: Array<{ parameterId: string; value: string }>
    },
  ) => apiClient.post<ScenarioSummary>(`/parameters/${projectId}/scenarios`, body),

  update: (
    projectId: string,
    scenarioId: string,
    body: {
      name?: string
      description?: string
      overrides?: Array<{ parameterId: string; value: string }>
    },
  ) => apiClient.put<ScenarioSummary>(`/parameters/${projectId}/scenarios/${scenarioId}`, body),

  remove: (projectId: string, scenarioId: string) =>
    apiClient.delete<{ id: string }>(`/parameters/${projectId}/scenarios/${scenarioId}`),

  setOverride: (
    projectId: string,
    scenarioId: string,
    parameterId: string,
    value: string,
  ) =>
    apiClient.put<ScenarioOverride>(
      `/parameters/${projectId}/scenarios/${scenarioId}/overrides/${parameterId}`,
      { value },
    ),

  removeOverride: (projectId: string, scenarioId: string, parameterId: string) =>
    apiClient.delete(
      `/parameters/${projectId}/scenarios/${scenarioId}/overrides/${parameterId}`,
    ),
}
