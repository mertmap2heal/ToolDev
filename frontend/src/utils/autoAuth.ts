/**
 * Auto-authentication utility for development
 * Creates a default user and logs in automatically if no token exists
 */
import { authService } from '../services/auth.service'

const DEFAULT_USER = {
  email: 'dev@example.com',
  password: 'dev123456',
  name: 'Development User',
}

let autoAuthAttempted = false

export async function ensureAuthenticated(): Promise<boolean> {
  // Check if we already have a token
  const existingToken = authService.getToken()
  if (existingToken) {
    return true
  }

  // Prevent multiple simultaneous attempts
  if (autoAuthAttempted) {
    return false
  }

  autoAuthAttempted = true

  try {
    // Try to login first
    const loginResponse = await authService.login({
      email: DEFAULT_USER.email,
      password: DEFAULT_USER.password,
    })

    if (loginResponse.success && loginResponse.data) {
      console.log('✅ Auto-logged in with default user')
      return true
    }

    // Check if it's a network error
    if (loginResponse.error?.includes('Cannot connect to backend') || loginResponse.error?.includes('Network')) {
      console.error('❌ Backend server is not running. Please start the backend server first.')
      console.error('   Run: cd backend && npm run dev')
      return false
    }

    // If login fails, try to register
    console.log('Login failed, attempting to register...')
    const registerResponse = await authService.register({
      email: DEFAULT_USER.email,
      password: DEFAULT_USER.password,
      name: DEFAULT_USER.name,
    })

    if (registerResponse.success && registerResponse.data) {
      console.log('✅ Auto-registered and logged in with default user')
      return true
    }

    // Check if registration also failed due to network error
    if (registerResponse.error?.includes('Cannot connect to backend') || registerResponse.error?.includes('Network')) {
      console.error('❌ Backend server is not running. Please start the backend server first.')
      console.error('   Run: cd backend && npm run dev')
      return false
    }

    console.error('❌ Auto-auth failed:', registerResponse.error || 'Unknown error')
    return false
  } catch (error: any) {
    console.error('❌ Auto-auth error:', error?.message || error)
    if (error?.message?.includes('Network') || error?.message?.includes('fetch')) {
      console.error('❌ Backend server is not running. Please start the backend server first.')
      console.error('   Run: cd backend && npm run dev')
    }
    return false
  } finally {
    autoAuthAttempted = false
  }
}
