import { prisma } from '../../lib/prisma'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../../uploads/verification/custom-sections')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

/**
 * Custom Section Service
 * Handles image uploads and file operations for custom sections
 */
export const customSectionService = {
  /**
   * Handle image upload and storage
   */
  async uploadImage(
    projectId: string,
    sectionId: string,
    fileData: string,
    fileName: string,
    mimeType?: string
  ): Promise<{
    id: string
    fileUrl: string
    storageKey: string
    fileSize: number
  }> {
    let buffer: Buffer
    let fileSize: number

    // Parse base64 data
    if (fileData.startsWith('data:')) {
      const base64Data = fileData.split(',')[1]
      buffer = Buffer.from(base64Data, 'base64')
    } else {
      buffer = Buffer.from(fileData, 'base64')
    }

    fileSize = buffer.length

    // Generate unique filename
    const fileExtension = path.extname(fileName)
    const uniqueFileName = `${randomUUID()}${fileExtension}`
    const filePath = path.join(uploadsDir, uniqueFileName)

    // Save file to filesystem
    fs.writeFileSync(filePath, buffer)

    // Create storage key and URL
    const storageKey = `verification/custom-sections/${uniqueFileName}`
    const fileUrl = `/uploads/verification/custom-sections/${uniqueFileName}`

    // Create image record in database
    const image = await prisma.verTestCaseSectionImage.create({
      data: {
        sectionId,
        projectId,
        fileName,
        fileUrl,
        storageKey,
        fileSize,
        mimeType: mimeType || null,
      },
    })

    return {
      id: image.id,
      fileUrl,
      storageKey,
      fileSize,
    }
  },

  /**
   * Delete image from filesystem and database
   */
  async deleteImage(imageId: string): Promise<void> {
    const image = await prisma.verTestCaseSectionImage.findUnique({
      where: { id: imageId },
    })

    if (!image) {
      throw new Error('Image not found')
    }

    // Delete file from filesystem
    if (image.fileUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../../..', image.fileUrl)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    // Delete record from database
    await prisma.verTestCaseSectionImage.delete({
      where: { id: imageId },
    })
  },
}
