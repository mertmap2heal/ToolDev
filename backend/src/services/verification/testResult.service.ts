import { prisma } from '../../lib/prisma'
import path from 'path'
import fs from 'fs'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import { validateUpload } from '../../lib/uploadValidation'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../../uploads/verification/test-results')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

/**
 * Test Result Service
 * Handles file uploads, storage, and linking operations for test results
 */
export const testResultService = {
  /**
   * Handle file upload and storage
   */
  async handleFileUpload(fileData: string, fileName: string, mimeType: string): Promise<{
    storageRef: string
    fileSize: number
    checksum: string
  }> {
    // Validate MIME + size BEFORE decoding (#131,#139). Throws UploadValidationError
    // with HTTP status 400/413/415 on violation.
    const validated = validateUpload({ fileData, fileName, mimeType })

    const checksum = createHash('sha256').update(validated.buffer).digest('hex')

    const filePath = path.join(uploadsDir, validated.uniqueFileName)
    fs.writeFileSync(filePath, validated.buffer)

    const storageRef = `/uploads/verification/test-results/${validated.uniqueFileName}`

    return {
      storageRef,
      fileSize: validated.fileSize,
      checksum,
    }
  },

  /**
   * Delete file from filesystem
   */
  async deleteFile(storageRef: string): Promise<void> {
    if (storageRef.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../../..', storageRef)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }
  },

  /**
   * Link test result to an entity (test case or test plan).
   *
   * SECURITY (HIGH-5): scope the linked entity lookup by projectId. Without
   * this, a member of project A can submit `linkedEntityId` of a TestCase /
   * TestPlan in project B and the link would be created — leaking cross-
   * project IDs into traceability + corrupting coverage queries.
   */
  async linkTestResult(params: {
    testResultId: string
    linkedEntityType: 'TEST_CASE' | 'TEST_PLAN'
    linkedEntityId: string
    relation?: 'PRIMARY' | 'SUPPORTING'
    projectId?: string
  }): Promise<void> {
    const { testResultId, linkedEntityType, linkedEntityId, relation = 'PRIMARY', projectId } = params

    // Check if link already exists
    const existingLink = await prisma.verTestResultLink.findFirst({
      where: {
        testResultId,
        linkedEntityType,
        linkedEntityId,
      },
    })

    if (existingLink) {
      throw new Error('Link already exists')
    }

    // Verify entity exists AND belongs to this project (when projectId
    // supplied — defensive: when omitted, behavior is unchanged for
    // backward compatibility with existing internal callers).
    if (linkedEntityType === 'TEST_CASE') {
      const testCase = await prisma.verTestCase.findFirst({
        where: projectId ? { id: linkedEntityId, projectId } : { id: linkedEntityId },
      })
      if (!testCase) {
        throw new Error('Test case not found')
      }
    } else if (linkedEntityType === 'TEST_PLAN') {
      const testPlan = await prisma.verTestPlan.findFirst({
        where: projectId ? { id: linkedEntityId, projectId } : { id: linkedEntityId },
      })
      if (!testPlan) {
        throw new Error('Test plan not found')
      }
    }

    // Create link
    await prisma.verTestResultLink.create({
      data: {
        testResultId,
        linkedEntityType,
        linkedEntityId,
        relation,
      },
    })
  },

  /**
   * Unlink test result from an entity
   */
  async unlinkTestResult(params: {
    testResultId: string
    linkedEntityType: 'TEST_CASE' | 'TEST_PLAN'
    linkedEntityId: string
  }): Promise<void> {
    const { testResultId, linkedEntityType, linkedEntityId } = params

    const link = await prisma.verTestResultLink.findFirst({
      where: {
        testResultId,
        linkedEntityType,
        linkedEntityId,
      },
    })

    if (!link) {
      throw new Error('Link not found')
    }

    await prisma.verTestResultLink.delete({
      where: { id: link.id },
    })
  },
}
