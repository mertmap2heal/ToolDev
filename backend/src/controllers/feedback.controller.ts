import { Request, Response } from 'express'
import { sendFeedbackEmail } from '../services/email.service.js'
import { PrismaClient } from '@prisma/client'
import { AuthRequest } from '../middleware/auth.middleware.js'

const prisma = new PrismaClient()

export const submitFeedback = async (req: Request, res: Response) => {
    console.log('[FeedbackController] submitFeedback called')
    try {
        const { message, fileData, fileName } = req.body
        const userId = (req as AuthRequest).userId

        let name = 'Anonymous'
        let email = 'anonymous@example.com'

        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true, email: true }
            })
            if (user) {
                name = user.name
                email = user.email
            }
        }

        const attachments = []
        if (fileData && fileName) {
            // Expecting fileData to be a base64 data URL
            const base64Data = fileData.split(',')[1]
            if (base64Data) {
                attachments.push({
                    filename: fileName,
                    content: Buffer.from(base64Data, 'base64'),
                })
            }
        }

        await sendFeedbackEmail({
            name,
            email,
            message,
            attachments,
        })

        res.json({ success: true, message: 'Feedback sent successfully' })
    } catch (error: any) {
        console.error('Submit feedback error:', error)
        res.status(500).json({ success: false, error: 'Failed to send feedback' })
    }
}
