import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import routes from './routes/index.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
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
