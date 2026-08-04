import { useState } from 'react'
import { useAdminAuth } from '../context/AdminAuthContext'
import { useNavigate } from 'react-router-dom'
import { Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { signInAdmin } = useAdminAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInAdmin(email, password)
      navigate('/')
    } catch (err) {
      console.error('[Admin Login Error]', err)
      setError(err.message || 'Invalid credentials or non-admin account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container single-layout">
      <div className="auth-form-side">
        <div className="auth-card animate-in">
          {/* Accountize Header Logo */}
          <div className="auth-header-logo">
            <img src="/logo.svg" alt="Accountize Admin Logo" className="auth-logo-icon" />
            <h1>Accountize Admin</h1>
            <p>Super Admin Command Center</p>
          </div>

          <h2 className="auth-title">Sign in to Command Center</h2>

          {error && (
            <div className="auth-alert error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-form-group">
              <label className="auth-label" htmlFor="admin-email">Admin Email</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="admin-email"
                  type="email"
                  className="auth-input"
                  placeholder="admin@accountize.app"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-form-group">
              <label className="auth-label" htmlFor="admin-password">Password</label>
              <div className="auth-input-wrapper">
                <Lock size={16} className="auth-input-icon" />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-toggle-password"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(prev => !prev)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? (
                <span className="auth-spinner"></span>
              ) : (
                <>
                  Login to Command Center <ArrowRight size={16} style={{ marginLeft: 6 }} />
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Protected by Enterprise Role-Based Access Control
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
