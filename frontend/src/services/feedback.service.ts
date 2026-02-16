import { apiClient } from './api'

export interface FeedbackData {
    message: string
    fileData?: string // base64
    fileName?: string
}

export const feedbackService = {
    sendFeedback: async (data: FeedbackData) => {
        const response = await apiClient.post('/feedback', data)
        return response.data
    },
}
