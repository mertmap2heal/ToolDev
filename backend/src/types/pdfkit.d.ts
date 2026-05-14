/**
 * Ambient types for pdfkit. The package ships JS-only and CI environments
 * without @types/pdfkit fail tsc with TS7016 ("Could not find a declaration
 * file for module 'pdfkit'"). This shim covers the surface used in the
 * Validation PDF export (size + margin opts, on/end, text positioning,
 * fonts). Keep it minimal - if a new pdfkit API is needed, extend here.
 */
declare module 'pdfkit' {
  import { Readable } from 'stream'

  interface PDFDocumentOptions {
    size?: string | [number, number]
    margin?: number
    margins?: { top?: number; bottom?: number; left?: number; right?: number }
    autoFirstPage?: boolean
    bufferPages?: boolean
    info?: Record<string, string>
  }

  interface TextOptions {
    align?: 'left' | 'center' | 'right' | 'justify'
    width?: number
    continued?: boolean
    underline?: boolean
    link?: string
    indent?: number
    lineGap?: number
  }

  class PDFDocument extends Readable {
    constructor(options?: PDFDocumentOptions)
    readonly page: { width: number; height: number; margins: { top: number; bottom: number; left: number; right: number } }
    y: number
    x: number
    addPage(options?: PDFDocumentOptions): this
    font(name: string, size?: number): this
    fontSize(size: number): this
    fillColor(color: string): this
    text(text: string, options?: TextOptions): this
    text(text: string, x?: number, y?: number, options?: TextOptions): this
    moveDown(lines?: number): this
    moveUp(lines?: number): this
    moveTo(x: number, y: number): this
    lineTo(x: number, y: number): this
    stroke(): this
    strokeColor(color: string): this
    lineWidth(w: number): this
    rect(x: number, y: number, width: number, height: number): this
    fill(color?: string): this
    image(src: string | Buffer, x?: number, y?: number, options?: { width?: number; height?: number; fit?: [number, number] }): this
    on(event: 'data', listener: (chunk: Buffer) => void): this
    on(event: 'end', listener: () => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
    end(): void
  }

  export = PDFDocument
}
