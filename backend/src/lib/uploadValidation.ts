import { randomUUID } from 'crypto'

/**
 * Permitted MIME types mapped to their canonical file extension.
 * Executables, scripts, HTML, and SVG are deliberately excluded.
 * Extension is derived from this map (never from client-supplied filename) to
 * prevent double-extension attacks like "document.pdf.exe".
 *
 * Mirrors the allowlist used in attachment.controller.ts (#27) and
 * issue.controller.ts (#161); see also verification module (#131).
 */
export const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/json': '.json',
  'application/msword': '.doc',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
}

export const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_TO_EXT))

/** Safe filename regex (for storing display name only — never used for on-disk path). */
export const SAFE_FILENAME_RE = /^[a-zA-Z0-9 ._\-()\[\]]+$/

/** Max raw file size (10 MB). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

/**
 * Base64 encodes 3 bytes → 4 chars, so encoded is ~1.37x raw size.
 * Use 1.5x buffer to guard against oversized payloads before calling
 * Buffer.from (which would otherwise allocate memory first).
 */
export const MAX_BASE64_CHARS = Math.ceil(MAX_FILE_BYTES * 1.5)

export class UploadValidationError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export interface ValidatedUpload {
  buffer: Buffer
  fileSize: number
  /** Server-generated filename: random UUID + allowlist-derived extension. */
  uniqueFileName: string
  /** Canonical extension derived from the MIME allowlist (not client filename). */
  ext: string
  /** Canonical MIME type (lowercase, trimmed). */
  mimeType: string
  /** Sanitized display name (client-supplied, for UI only — never for disk paths). */
  safeDisplayName: string
}

/**
 * Validate and decode an upload payload. Throws UploadValidationError on:
 * - missing mimeType or fileData
 * - mimeType not in allowlist
 * - pre-decode base64 length exceeds MAX_BASE64_CHARS
 * - decoded size exceeds MAX_FILE_BYTES
 * - unsafe display name (falls back to "file<ext>" for display)
 */
export function validateUpload(input: {
  fileData: string
  fileName?: string
  mimeType?: string
}): ValidatedUpload {
  const { fileData, fileName, mimeType } = input
  if (!fileData) {
    throw new UploadValidationError('fileData is required')
  }
  const mime = (mimeType ?? '').trim().toLowerCase()
  if (!mime) {
    throw new UploadValidationError('mimeType is required')
  }
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new UploadValidationError(`Unsupported file type: ${mime}`, 415)
  }

  const base64 = fileData.startsWith('data:') ? fileData.split(',')[1] ?? '' : fileData
  if (base64.length > MAX_BASE64_CHARS) {
    throw new UploadValidationError(
      `File exceeds ${MAX_FILE_BYTES} bytes before decoding`,
      413,
    )
  }

  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length > MAX_FILE_BYTES) {
    throw new UploadValidationError(
      `File exceeds ${MAX_FILE_BYTES} bytes after decoding`,
      413,
    )
  }

  const ext = MIME_TO_EXT[mime]!
  const uniqueFileName = `${randomUUID()}${ext}`
  const safeDisplayName = fileName && SAFE_FILENAME_RE.test(fileName) ? fileName : `file${ext}`

  return {
    buffer,
    fileSize: buffer.length,
    uniqueFileName,
    ext,
    mimeType: mime,
    safeDisplayName,
  }
}

/**
 * Same as validateUpload but for a multer-provided buffer (no base64).
 * Used when routes accept multipart/form-data.
 */
export function validateMulterUpload(file: {
  buffer: Buffer
  originalname: string
  mimetype: string
}): ValidatedUpload {
  const mime = (file.mimetype ?? '').trim().toLowerCase()
  if (!mime) {
    throw new UploadValidationError('mimeType is required')
  }
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new UploadValidationError(`Unsupported file type: ${mime}`, 415)
  }
  if (file.buffer.length > MAX_FILE_BYTES) {
    throw new UploadValidationError(`File exceeds ${MAX_FILE_BYTES} bytes`, 413)
  }
  const ext = MIME_TO_EXT[mime]!
  const uniqueFileName = `${randomUUID()}${ext}`
  const safeDisplayName = file.originalname && SAFE_FILENAME_RE.test(file.originalname)
    ? file.originalname
    : `file${ext}`
  return {
    buffer: file.buffer,
    fileSize: file.buffer.length,
    uniqueFileName,
    ext,
    mimeType: mime,
    safeDisplayName,
  }
}
