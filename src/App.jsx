import { Component, useEffect, useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext'
import NetworkStatusBanner from './components/NetworkStatusBanner'
import LoadingScreen from './components/LoadingScreen'
import Overview from './pages/Overview'
import AnalyticsStream from './pages/AnalyticsStream'
import ErrorInspector from './pages/ErrorInspector'
import SupportTickets from './pages/SupportTickets'
import UserManager from './pages/UserManager'
import Governance from './pages/Governance'
import Login from './pages/Login'
import {
  LayoutDashboard, Activity, AlertTriangle, MessageSquare,
  Users, ShieldCheck, LogOut, Shield, ExternalLink, RefreshCw
} from 'lucide-react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Dashboard Error Boundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          padding: 24,
          textAlign: 'center'
        }}>
          <AlertTriangle size={48} color="var(--rose)" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>Dashboard Interface Error</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: 460, marginBottom: 20 }}>
            {this.state.error?.message || 'An unexpected rendering error occurred in the Super Admin Dashboard.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
          >
            <RefreshCw size={14} /> Reload Application
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

function AdminProtectedRoute({ children }) {
  const { user, isAdmin, loading } = useAdminAuth()

  if (loading) {
    return <LoadingScreen label="Loading Command Center..." sublabel="Verifying admin credentials & permissions" fullScreen={true} />
  }

  if (!user || !isAdmin) {
    return <Navigate to="/login" replace />
  }

  return children
}

function AdminLayout() {
  const { user, signOutAdmin } = useAdminAuth()
  const location = useLocation()

  // Synchronously reset scroll position to top across all scroll containers on route change
  useLayoutEffect(() => {
    const scrollToTop = () => {
      const mainEl = document.querySelector('.admin-main')
      if (mainEl) {
        mainEl.scrollTop = 0
        mainEl.scrollLeft = 0
      }
      const contentEl = document.querySelector('.admin-content')
      if (contentEl) {
        contentEl.scrollTop = 0
      }
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    scrollToTop()
    requestAnimationFrame(scrollToTop)
    const timer = setTimeout(scrollToTop, 50)
    return () => clearTimeout(timer)
  }, [location.pathname])

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Overview', shortLabel: 'Overview' },
    { path: '/analytics', icon: Activity, label: 'Analytics', shortLabel: 'Analytics' },
    { path: '/errors', icon: AlertTriangle, label: 'Errors', shortLabel: 'Errors' },
    { path: '/tickets', icon: MessageSquare, label: 'Tickets', shortLabel: 'Tickets' },
    { path: '/users', icon: Users, label: 'Users', shortLabel: 'Users' },
    { path: '/governance', icon: ShieldCheck, label: 'Audit', shortLabel: 'Audit' },
  ]

  return (
    <div className="admin-layout">
      {/* Desktop & Tablet Sidebar Navigation */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="sidebar-logo">
            <img src="/logo.svg" alt="Accountify Logo" className="sidebar-logo-icon" />
            <div className="sidebar-logo-text">
              <h1>Accountify Admin</h1>
              <p>Super Admin Center</p>
            </div>
          </div>
        </div>

        <nav className="admin-nav">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <div className="admin-user-footer">
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
              {user?.email || 'Super Admin'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} /> Verified Admin
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={signOutAdmin} title="Logout Admin">
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        {/* App Top Bar */}
        <header className="admin-header">
          <div className="sidebar-logo">
            <img src="/logo.svg" alt="Accountify Logo" className="sidebar-logo-icon" style={{ width: 30, height: 30 }} />
            <div className="sidebar-logo-text">
              <h1 style={{ fontSize: '0.95rem' }}>Accountify Admin</h1>
            </div>
          </div>

          <div className="desktop-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <span>Accountify Command Center</span>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>admin.accountify.app</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-green desktop-only-badge">Production</span>
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ borderRadius: 'var(--radius-full)' }}
            >
              Client App <ExternalLink size={12} />
            </a>
            <button className="mobile-logout-btn btn btn-secondary btn-sm" onClick={signOutAdmin} title="Logout">
              <LogOut size={14} />
            </button>
          </div>
        </header>

        <div className="admin-content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/analytics" element={<AnalyticsStream />} />
            <Route path="/errors" element={<ErrorInspector />} />
            <Route path="/tickets" element={<SupportTickets />} />
            <Route path="/users" element={<UserManager />} />
            <Route path="/governance" element={<Governance />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>

      {/* Native Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.shortLabel}</span>
            </NavLink>
          )
        })}
      </nav>
      <NetworkStatusBanner />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AdminAuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <AdminProtectedRoute>
                  <AdminLayout />
                </AdminProtectedRoute>
              }
            />
          </Routes>
        </AdminAuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
