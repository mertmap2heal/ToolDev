import { apiClient } from './api';
import type { Document } from '../pages/Documentation/types';

export const documentationService = {
  async listDocuments(projectId: string) {
    return apiClient.get<Document[]>(`/projects/${projectId}/documents`);
  },
  async getDocument(projectId: string, id: string) {
    return apiClient.get<Document>(`/projects/${projectId}/documents/${id}`);
  },
  async createDocument(projectId: string, doc: Partial<Document>) {
    return apiClient.post<Document>(`/projects/${projectId}/documents`, doc);
  },
  async updateDocument(projectId: string, id: string, doc: Partial<Document>) {
    return apiClient.put<Document>(`/projects/${projectId}/documents/${id}`, doc);
  },
  async deleteDocument(projectId: string, id: string) {
    return apiClient.delete(`/projects/${projectId}/documents/${id}`);
  },
};
