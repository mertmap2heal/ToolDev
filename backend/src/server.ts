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

// CORS — restrict to the configured frontend origin (#35)
// In dev, APP_URL defaults to localhost:3000.
// In production, set APP_URL to the deployed frontend origin.
const allowedOrigins = new Set<string>([
  process.env.APP_URL || 'http://localhost:3000',
  'http://localhost:3000', // always allow local dev
])

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no Origin header) and known origins
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`))
    }
  },
  credentials: true,
}))

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
      setInterval(() => runCleanup('scheduled'), 24 * 60 * 60 * 1000)
    })
  }).on('error', (err: NodeJS.ErrnoException) => {
    logger.error('server_listen_failed', { error: err.message, code: err.code })
    if (err.code === 'EADDRINUSE') logger.error('port_in_use', { port: PORT })
  })
}

export { app }
