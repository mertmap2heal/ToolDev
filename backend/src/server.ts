import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import routes from './routes/index.js'
import feedbackRoutes from './routes/feedback.routes.js'

dotenv.config()

console.log('Server: loading Prisma and routes...')
const prisma = new PrismaClient()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

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
    console.error('DB health check failed:', err.message)
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
app.use(async (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)

  // Log to file for debugging
  const logPath = path.join(__dirname, '../error.log')
  const logMessage = `[${new Date().toISOString()}] ${err.stack || err.message}\n`
  // Ensure fs is imported at top of file
  try {
    const fs = await import('fs');
    fs.default.appendFileSync(logPath, logMessage)
  } catch (e) {
    console.error('Failed to write to log file:', e)
  }

  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message ?? 'Internal server error')
  res.status(500).json({ success: false, error: message })
})

if (process.env.NODE_ENV !== 'test') {
  console.log('Server: binding to port', PORT, '...')
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)

    // Schedule cleanup job (daily)
    import('./services/cleanup.service.js').then(({ cleanupSoftDeletedRequirements }) => {
      // Run immediately on startup (for dev/demo purposes)
      cleanupSoftDeletedRequirements().catch(err => console.error('Cleanup startup error:', err))

      // Schedule daily (86400000 ms)
      setInterval(() => {
        cleanupSoftDeletedRequirements().catch(err => console.error('Cleanup interval error:', err))
      }, 24 * 60 * 60 * 1000)
    })
  }).on('error', (err: NodeJS.ErrnoException) => {
    console.error('Server failed to listen:', err.message)
    if (err.code === 'EADDRINUSE') console.error('Port', PORT, 'is already in use.')
  })
}

export { app }
