import express from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { prisma } from './lib/prisma'
import { logger, setRequestId } from './lib/logger.js'
import routes from './routes/index.js'
import feedbackRoutes from './routes/feedback.routes.js'
import http from 'http'
import { setupRealtime } from './realtime/realtime.js'

dotenv.config()

logger.info('server_loading', { message: 'Loading Prisma and routes' })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


const app = express()
const PORT = process.env.PORT || 5000
const server = http.createServer(app)

// CORS — env-driven allowlist (#35, #149). Localhost is only permitted when
// NODE_ENV !== 'production'. Production must set APP_URL (and optionally
// SOCKET_IO_ALLOWED_ORIGINS, comma-separated) or startup throws.
export const buildCorsOrigins = (env: NodeJS.ProcessEnv = process.env): string[] => {
  const configured = [
    env.APP_URL,
    ...(env.SOCKET_IO_ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()),
  ].filter((v): v is string => Boolean(v))
  if (env.NODE_ENV === 'production') {
    if (configured.length === 0) {
      throw new Error('CORS configuration error: set APP_URL (and/or SOCKET_IO_ALLOWED_ORIGINS) in production')
    }
    return configured
  }
  return [...configured, 'http://localhost:3000', 'http://127.0.0.1:3000']
}

const corsAllowlist = buildCorsOrigins()

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      return cb(null, corsAllowlist.includes(origin))
    },
    credentials: true,
  }),
)

// Request ID middleware — attaches a unique ID to every request for log correlation (#42)
app.use((req, res, next) => {
  const id = (req.headers['x-request-id'] as string) || randomUUID()
  res.setHeader('X-Request-Id', id)
  setRequestId(id)
  res.on('finish', () => setRequestId(undefined))
  next()
})


app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Security headers applied to every response (#29)
// X-Frame-Options: DENY — prevents this API from being embedded in a foreign frame (no backend HTML pages exist)
// X-Content-Type-Options: nosniff — browsers must use the declared Content-Type, not sniff
// Referrer-Policy — prevents full URL paths (containing project IDs) leaking to third-party origins
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  next()
})

// Serve static files from uploads directory
// Force browser to download rather than execute/render uploaded content
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  setHeaders: (res) => {
    res.setHeader('Content-Disposition', 'attachment')
    res.setHeader('X-Content-Type-Options', 'nosniff')
  },
}))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

app.get('/api/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    const projectCount = await prisma.project.count()
    res.json({ ok: true, projectCount })
  } catch (e) {
    const err = e as Error
    logger.error('db_health_failed', { error: err.message })
    res.status(503).json({
      ok: false,
      error: err.message || 'Database connection failed',
    })
  }
})

app.get('/api/v1', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API v1 is running',
    endpoints: {
      health: '/api/health',
      auth: '/api/v1/auth',
      projects: '/api/v1/projects',
      functions: '/api/v1/functions',
      parameters: '/api/v1/parameters',
      issues: '/api/v1/issues',
      compliance: '/api/v1/compliance',
      requirements: '/api/v1/requirements',
      workflow: '/api/v1/workflow',
    },
  })
})

app.use('/api/v1', routes)
app.use('/api/v1/feedback', feedbackRoutes)

// Global error handler: return JSON 500 for any unhandled errors
app.use(async (err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('unhandled_error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
  })

  // Also persist to error.log for post-mortem debugging
  const logPath = path.join(__dirname, '../error.log')
  const logMessage = `[${new Date().toISOString()}] ${err.stack || err.message}\n`
  try {
    const fs = await import('fs')
    fs.default.appendFileSync(logPath, logMessage)
  } catch (e) {
    logger.error('error_log_write_failed', { error: (e as Error).message })
  }

  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message ?? 'Internal server error')
  res.status(500).json({ success: false, error: message })
})

if (process.env.NODE_ENV !== 'test') {
  logger.info('server_starting', { port: PORT })
  // Start real-time server
  const io = setupRealtime(server, prisma)

  // #282: capture the cleanup interval handle so we can clear it on
  // shutdown; an orphaned setInterval was holding the event loop open.
  let cleanupIntervalHandle: NodeJS.Timeout | null = null

  server.listen(PORT, () => {
    logger.info('server_ready', { port: PORT })

    // Schedule cleanup job (daily)
    import('./services/cleanup.service.js').then(({ cleanupSoftDeletedRequirements }) => {
      const runCleanup = (trigger: string) => {
        cleanupSoftDeletedRequirements().catch((err: Error) => {
          logger.error('cleanup_job_failed', { trigger, error: err.message })
        })
      }

      // Run immediately on startup (for dev/demo purposes)
      runCleanup('startup')

      // Schedule daily (86400000 ms)
      cleanupIntervalHandle = setInterval(() => runCleanup('scheduled'), 24 * 60 * 60 * 1000)
    })
  }).on('error', (err: NodeJS.ErrnoException) => {
    logger.error('server_listen_failed', { error: err.message, code: err.code })
    if (err.code === 'EADDRINUSE') logger.error('port_in_use', { port: PORT })
  })

  // #282: graceful shutdown. On SIGTERM / SIGINT, stop accepting new
  // connections, let in-flight requests drain, close Socket.IO + the
  // cleanup interval, and $disconnect() Prisma before exiting. A
  // 10s hard-kill timer catches hung sockets so the orchestrator
  // doesn't wait forever.
  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info('server_shutting_down', { signal })

    // Hard-kill fallback in case server.close() hangs on a long request.
    const hardKill = setTimeout(() => {
      logger.error('server_shutdown_forced', { signal })
      process.exit(1)
    }, 10_000)
    hardKill.unref()

    server.close(async (closeErr?: Error) => {
      if (closeErr) {
        logger.error('server_close_failed', { error: closeErr.message })
      }
      try {
        io.close()
      } catch (e) {
        logger.error('io_close_failed', { error: (e as Error).message })
      }
      if (cleanupIntervalHandle) {
        clearInterval(cleanupIntervalHandle)
        cleanupIntervalHandle = null
      }
      try {
        await prisma.$disconnect()
      } catch (e) {
        logger.error('prisma_disconnect_failed', { error: (e as Error).message })
      }
      clearTimeout(hardKill)
      logger.info('server_shutdown_complete', { signal })
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

export { app }
