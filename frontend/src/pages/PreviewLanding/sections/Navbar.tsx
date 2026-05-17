import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="pl-nav" aria-label="Primary">
      <div className="pl-container pl-nav__inner">
        <Link to="/" className="pl-wordmark">VERUM</Link>
        <div className="pl-nav-items">
          <a href="#product" className="pl-nav-link pl-nav-desktop-only">Product</a>
          <Link to="/login" className="pl-nav-link">Sign in</Link>
          <Link to="/login" className="pl-cta-primary pl-nav__cta">
            Start free
          </Link>
        </div>
      </div>
    </nav>
  )
}
