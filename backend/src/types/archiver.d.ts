/**
 * Ambient types for archiver (ensures tsc works when @types resolution fails in some environments).
 * Extends stream.Readable so callers can return archiver instances as Readable.
 */
declare module 'archiver' {
  import { Readable } from 'stream'

  interface EntryData {
    name?: string
    prefix?: string
    stats?: unknown
  }

  interface ArchiverError extends Error {
    code?: string
  }

  interface Archiver extends Readable {
    abort(): this
    append(source: Buffer | Readable | string, data?: EntryData): this
    directory(dirpath: string, destpath?: string, data?: EntryData): this
    file(filepath: string, data?: EntryData): this
    glob(pattern: string, options?: unknown, data?: EntryData): this
    on(event: 'error', listener: (err: ArchiverError) => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
    pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean }): T
    finalize(): void
  }

  type ArchiverFormat = 'zip' | 'tar' | 'json'

  function archiver(format: ArchiverFormat, options?: Record<string, unknown>): Archiver

  export default archiver
}
