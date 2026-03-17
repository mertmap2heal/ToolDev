import { apiClient } from './api'
import type { UseCase, Actor, CreateUseCaseDto, UpdateUseCaseDto, CreateActorDto, UpdateActorDto } from 'shared/types/usecase.types'
import type { ApiResponse } from 'shared/types/api.types'

export const useCaseService = {
  async getUseCases(projectId: string): Promise<ApiResponse<UseCase[]>> {
    return apiClient.get<UseCase[]>(`/usecases/${projectId}`)
  },

  async getUseCase(projectId: string, useCaseId: string): Promise<ApiResponse<UseCase>> {
    return apiClient.get<UseCase>(`/usecases/${projectId}/${useCaseId}`)
  },

  async createUseCase(projectId: string, data: CreateUseCaseDto): Promise<ApiResponse<UseCase>> {
    return apiClient.post<UseCase>(`/usecases/${projectId}`, data)
  },

  async updateUseCase(projectId: string, useCaseId: string, data: UpdateUseCaseDto): Promise<ApiResponse<UseCase>> {
    return apiClient.put<UseCase>(`/usecases/${projectId}/${useCaseId}`, data)
  },

  async deleteUseCase(projectId: string, useCaseId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/usecases/${projectId}/${useCaseId}`)
  },

  async getActors(projectId: string): Promise<ApiResponse<Actor[]>> {
    return apiClient.get<Actor[]>(`/usecases/${projectId}/actors`)
  },

  async createActor(projectId: string, data: CreateActorDto): Promise<ApiResponse<Actor>> {
    return apiClient.post<Actor>(`/usecases/${projectId}/actors`, data)
  },

  async updateActor(projectId: string, actorId: string, data: UpdateActorDto): Promise<ApiResponse<Actor>> {
    return apiClient.put<Actor>(`/usecases/${projectId}/actors/${actorId}`, data)
  },

  async deleteActor(projectId: string, actorId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/usecases/${projectId}/actors/${actorId}`)
  },
}
