import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { authService } from '../services/auth.service'
import { useAuthStore } from '../store/authStore'
import LandingPage from '../pages/Landing/LandingPage'

export default function LandingOrApp() {
  const token = authService.getToken()
  const { user, setUser } = useAuthStore()

  useEffect(() => {
    if (token && !user) {
      authService.getCurrentUser().then((res) => {
        if (res.success && res.data) {
          setUser(res.data)
        }
      })
    }
  }, [token, user, setUser])

  if (!token) {
    return <LandingPage />
  }

  return <Outlet />
}
