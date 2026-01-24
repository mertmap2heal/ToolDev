import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import routes from './routes/index.js'

dotenv.config()

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
      requirements: '/api/v1/requirements',
      workflow: '/api/v1/workflow',
    },
  })
})

app.use('/api/v1', routes)

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
