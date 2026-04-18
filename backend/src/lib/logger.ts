/**
 * Structured JSON logger — no external dependencies.
 *
 * Every log line is a single JSON object written to stdout (info/warn) or
 * stderr (error). Log aggregators (Datadog, CloudWatch, Loki, …) can parse
 * these lines without additional configuration.
 *
 * Each record always contains:
 *   level      — "info" | "warn" | "error"
 *   event      — machine-readable event name (e.g. "request_start")
 *   timestamp  — ISO-8601 UTC
 *   requestId  — set by requestId middleware if the log comes from a request
 *   ...extras  — any additional key/value pairs passed by the caller
 *
 * Usage:
 *   import { logger } from '../lib/logger'
 *   logger.info('server_start', { port: 5000 })
 *   logger.warn('rate_limit_hit', { ip, path })
 *   logger.error('db_query_failed', { error: err.message, query: 'findMany' })
 */

type LogLevel = 'info' | 'warn' | 'error'
type LogData = Record<string, unknown>

// Thread-local request ID — set by requestId middleware, cleared after response
let _requestId: string | undefined

export function setRequestId(id: string | undefined): void {
  _requestId = id
}

export function getRequestId(): string | undefined {
  return _requestId
}

function write(level: LogLevel, event: string, data?: LogData): void {
  const record: Record<string, unknown> = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...((_requestId) ? { requestId: _requestId } : {}),
    ...data,
  }

  // Sanitize: replace newlines in string values to prevent log-record splitting
  for (const key of Object.keys(record)) {
    if (typeof record[key] === 'string') {
      record[key] = (record[key] as string).replace(/[\r\n]+/g, ' ')
    }
  }

  const line = JSON.stringify(record) + '\n'
  if (level === 'error') {
    process.stderr.write(line)
  } else {
    process.stdout.write(line)
  }
}

export const logger = {
  info:  (event: string, data?: LogData) => write('info',  event, data),
  warn:  (event: string, data?: LogData) => write('warn',  event, data),
  error: (event: string, data?: LogData) => write('error', event, data),
}
