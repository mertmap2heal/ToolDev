import { apiClient } from './api'

export interface FeedbackData {
    message: string
    fileData?: string // base64
    fileName?: string
}

export const feedbackService = {
    sendFeedback: async (data: FeedbackData) => {
        const response = await apiClient.post<{ message?: string }>('/feedback', data)
        if (response && response.success === false) {
            throw new Error(response.error ?? 'Failed to send feedback')
        }
        return response.data
    },
}
