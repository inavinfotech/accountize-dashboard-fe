import { useState } from 'react'
import { useAdminAuth } from '../context/AdminAuthContext'
import { useNavigate } from 'react-router-dom'
import { Shield, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react'

export default function Login() {
  const { signInAdmin } = useAdminAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 0%, #eef2ff 0%, #f8fafc 70%)',
      padding: '20px'
    }}>
      <div className="animate-in" style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-xl)',
        padding: '36px',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            boxShadow: '0 0 20px rgba(59,130,246,0.4)'
          }}>
            <Shield size={28} />
          </div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Accountify Admin</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
            Super Admin Command Center Login
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--rose-bg)',
            border: '1px solid rgba(244,63,94,0.3)',
            color: 'var(--rose)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.825rem',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 20
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Admin Email
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: 12 }} />
              <input
                type="email"
                className="search-input"
                style={{ width: '100%', paddingLeft: 40, height: 42 }}
                placeholder="admin@accountify.app"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 14, top: 12 }} />
              <input
                type="password"
                className="search-input"
                style={{ width: '100%', paddingLeft: 40, height: 42 }}
                placeholder="••••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', height: 42, marginTop: 8 }}
          >
            {loading ? 'Authenticating...' : <>Login to Command Center <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  )
}
