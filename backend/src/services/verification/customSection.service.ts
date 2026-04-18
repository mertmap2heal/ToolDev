import { prisma } from '../../lib/prisma'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { validateUpload, UploadValidationError } from '../../lib/uploadValidation'

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
    mimeType: string,
  ): Promise<{
    id: string
    fileUrl: string
    storageKey: string
    fileSize: number
  }> {
    // Validate MIME + size BEFORE decoding (#131,#139). Only image/* accepted.
    const validated = validateUpload({ fileData, fileName, mimeType })
    if (!validated.mimeType.startsWith('image/')) {
      throw new UploadValidationError('Only image uploads are allowed here', 415)
    }

    const filePath = path.join(uploadsDir, validated.uniqueFileName)
    fs.writeFileSync(filePath, validated.buffer)

    const storageKey = `verification/custom-sections/${validated.uniqueFileName}`
    const fileUrl = `/uploads/verification/custom-sections/${validated.uniqueFileName}`

    const image = await prisma.verTestCaseSectionImage.create({
      data: {
        sectionId,
        projectId,
        fileName: validated.safeDisplayName,
        fileUrl,
        storageKey,
        fileSize: validated.fileSize,
        mimeType: validated.mimeType,
      },
    })

    return {
      id: image.id,
      fileUrl,
      storageKey,
      fileSize: validated.fileSize,
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
