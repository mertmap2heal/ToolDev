export default function Navbar() {
  return (
    <nav className="pl-nav" aria-label="Primary">
      <div className="pl-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 32px' }}>
        <a href="#top" className="pl-wordmark">VERUM</a>
        <div className="pl-nav-items">
          <a href="#product" className="pl-nav-link pl-nav-desktop-only">Product</a>
          <a href="#customers" className="pl-nav-link pl-nav-desktop-only">Customers</a>
          <a href="#pricing" className="pl-nav-link pl-nav-desktop-only">Pricing</a>
          <a href="#docs" className="pl-nav-link pl-nav-desktop-only">Docs</a>
          <a href="#signin" className="pl-nav-link">Sign in</a>
          <a href="#start" className="pl-cta-primary" style={{ height: 36, padding: '0 16px', fontSize: 14 }}>
            Start free
          </a>
        </div>
      </div>
    </nav>
  )
}
