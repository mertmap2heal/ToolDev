import { describe, it, expect } from 'vitest'
import {
  validateUpload,
  validateMulterUpload,
  UploadValidationError,
  MAX_FILE_BYTES,
  MAX_BASE64_CHARS,
  ALLOWED_MIME_TYPES,
} from '../lib/uploadValidation'

const PNG_MIN = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])
const PNG_B64 = PNG_MIN.toString('base64')

describe('uploadValidation (#131,#139)', () => {
  it('accepts a valid PNG base64 payload', () => {
    const out = validateUpload({ fileData: PNG_B64, fileName: 'ok.png', mimeType: 'image/png' })
    expect(out.mimeType).toBe('image/png')
    expect(out.ext).toBe('.png')
    expect(out.fileSize).toBeGreaterThan(0)
    expect(out.uniqueFileName.endsWith('.png')).toBe(true)
  })

  it('accepts a data: URI prefix', () => {
    const out = validateUpload({
      fileData: `data:image/png;base64,${PNG_B64}`,
      fileName: 'ok.png',
      mimeType: 'image/png',
    })
    expect(out.fileSize).toBeGreaterThan(0)
  })

  it('rejects missing fileData', () => {
    expect(() =>
      validateUpload({ fileData: '', fileName: 'a.png', mimeType: 'image/png' }),
    ).toThrow(UploadValidationError)
  })

  it('rejects missing mimeType', () => {
    expect(() =>
      validateUpload({ fileData: PNG_B64, fileName: 'a.png' }),
    ).toThrow(UploadValidationError)
  })

  it('rejects executable MIME type', () => {
    expect(() =>
      validateUpload({
        fileData: PNG_B64,
        fileName: 'payload.exe',
        mimeType: 'application/x-msdownload',
      }),
    ).toThrow(UploadValidationError)
  })

  it('rejects HTML MIME type', () => {
    expect(() =>
      validateUpload({ fileData: PNG_B64, fileName: 'x.html', mimeType: 'text/html' }),
    ).toThrow(UploadValidationError)
  })

  it('rejects SVG MIME type (XSS vector)', () => {
    expect(() =>
      validateUpload({ fileData: PNG_B64, fileName: 'x.svg', mimeType: 'image/svg+xml' }),
    ).toThrow(UploadValidationError)
  })

  it('rejects a payload larger than MAX_BASE64_CHARS before decoding', () => {
    const oversized = 'A'.repeat(MAX_BASE64_CHARS + 1)
    try {
      validateUpload({ fileData: oversized, fileName: 'big.bin', mimeType: 'application/pdf' })
      throw new Error('expected to throw')
    } catch (e: any) {
      expect(e).toBeInstanceOf(UploadValidationError)
      expect(e.status).toBe(413)
    }
  })

  it('derives extension from MIME (not client filename) — prevents double-extension bypass', () => {
    const out = validateUpload({
      fileData: PNG_B64,
      fileName: 'sneaky.pdf.exe',
      mimeType: 'image/png',
    })
    expect(out.ext).toBe('.png')
    expect(out.uniqueFileName.endsWith('.png')).toBe(true)
    expect(out.uniqueFileName).not.toContain('.exe')
  })

  it('sanitizes unsafe display name to "file<ext>"', () => {
    const out = validateUpload({
      fileData: PNG_B64,
      fileName: '../../../etc/passwd',
      mimeType: 'image/png',
    })
    expect(out.safeDisplayName).toBe('file.png')
  })

  it('preserves safe display names', () => {
    const out = validateUpload({
      fileData: PNG_B64,
      fileName: 'report-final (v2).pdf',
      mimeType: 'application/pdf',
    })
    expect(out.safeDisplayName).toBe('report-final (v2).pdf')
  })

  describe('validateMulterUpload', () => {
    it('accepts valid multipart buffer', () => {
      const out = validateMulterUpload({
        buffer: PNG_MIN,
        originalname: 'photo.png',
        mimetype: 'image/png',
      })
      expect(out.mimeType).toBe('image/png')
      expect(out.fileSize).toBe(PNG_MIN.length)
    })

    it('rejects oversized buffer', () => {
      try {
        validateMulterUpload({
          buffer: Buffer.alloc(MAX_FILE_BYTES + 1),
          originalname: 'big.pdf',
          mimetype: 'application/pdf',
        })
        throw new Error('expected to throw')
      } catch (e: any) {
        expect(e).toBeInstanceOf(UploadValidationError)
        expect(e.status).toBe(413)
      }
    })

    it('rejects disallowed MIME in multipart upload', () => {
      expect(() =>
        validateMulterUpload({
          buffer: PNG_MIN,
          originalname: 'x.sh',
          mimetype: 'application/x-sh',
        }),
      ).toThrow(UploadValidationError)
    })
  })

  it('allowlist contains the expected 16 MIME types', () => {
    expect(ALLOWED_MIME_TYPES.size).toBe(16)
    expect(ALLOWED_MIME_TYPES.has('image/svg+xml')).toBe(false)
    expect(ALLOWED_MIME_TYPES.has('text/html')).toBe(false)
    expect(ALLOWED_MIME_TYPES.has('application/x-msdownload')).toBe(false)
    expect(ALLOWED_MIME_TYPES.has('image/png')).toBe(true)
    expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(true)
  })
})
