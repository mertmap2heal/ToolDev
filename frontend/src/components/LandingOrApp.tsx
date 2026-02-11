import { Outlet } from 'react-router-dom'
import { authService } from '../services/auth.service'
import LandingPage from '../pages/Landing/LandingPage'

export default function LandingOrApp() {
  const token = authService.getToken()

  if (!token) {
    return <LandingPage />
  }

  return <Outlet />
}
