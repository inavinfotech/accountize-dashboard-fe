import { useState, useEffect, useCallback } from 'react'
import { supabase, fetchUserProfiles } from '../lib/supabase'
import LoadingScreen from '../components/LoadingScreen'
import {
  Settings, ToggleLeft, ToggleRight, RefreshCw, Save,
  LogIn, UserPlus, LayoutDashboard, AlertTriangle,
  CheckCircle, XCircle, Clock, Shield, Code, Eye,
  Wand2, FileCode, Copy, Check
} from 'lucide-react'

// Service definitions with metadata
const SERVICE_DEFINITIONS = [
  {
    key: 'login_enabled',
    label: 'Login',
    description: 'Controls whether existing users can sign in to their accounts.',
    icon: LogIn,
    color: '#3b82f6',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    criticalWarning: 'Disabling login will lock ALL existing users out of their accounts. Only Signup and public pages will remain accessible.'
  },
  {
    key: 'signup_enabled',
    label: 'Signup',
    description: 'Controls whether new users can register for an account.',
    icon: UserPlus,
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    criticalWarning: 'Disabling signup will prevent any new user from creating an account. Existing users can still log in.'
  },
  {
    key: 'user_panel_enabled',
    label: 'User Panel',
    description: 'Controls access to the main application dashboard after login.',
    icon: LayoutDashboard,
    color: '#10b981',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    criticalWarning: 'Disabling the user panel will show a maintenance screen to all logged-in users. Login & Signup will still work.'
  }
]

// Sample HTML Templates for Admins
const HTML_SNIPPETS = [
  {
    name: 'Registration Complete Launch HTML',
    code: `<div style="min-height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: radial-gradient(circle at top left, #dbeafe 0, transparent 35%), radial-gradient(circle at bottom right, #ede9fe 0, transparent 35%), #f8fafc; color: #0f172a; box-sizing: border-box;">
  <style>
    @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pop { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
    .cnt-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 14px; }
    .cnt-box { background: #ffffff; padding: 10px 4px; border-radius: 12px; border: 1px solid #cbd5e1; box-shadow: 0 4px 10px rgba(0,0,0,0.03); }
    .cnt-num { font-size: 22px; font-weight: 800; color: #1d4ed8; line-height: 1.1; }
    .cnt-lbl { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-top: 2px; }
  </style>

  <div style="width: 100%; max-width: 480px; padding: 44px 28px; text-align: center; background: rgba(255, 255, 255, 0.92); border: 1px solid rgba(255, 255, 255, 0.8); border-radius: 28px; box-shadow: 0 25px 70px rgba(15, 23, 42, 0.12); backdrop-filter: blur(15px); animation: fadeUp 0.7s ease-out; box-sizing: border-box;">
    <div style="width: 78px; height: 78px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; border-radius: 20px; background: #ffffff; border: 1px solid rgba(226, 232, 240, 0.8); box-shadow: 0 12px 30px rgba(99, 102, 241, 0.2); animation: pop 0.6s ease-out 0.2s both;"><img src="https://accountize.in/logo.svg" alt="Accountize Logo" style="width: 48px; height: 48px; object-fit: contain;" /></div>
    <div style="display: inline-block; margin-bottom: 14px; padding: 7px 14px; border-radius: 999px; background: #eff6ff; color: #2563eb; font-size: 13px; font-weight: 700; letter-spacing: 0.4px;">REGISTRATION COMPLETE</div>
    <h1 style="margin-bottom: 12px; font-size: clamp(26px, 6vw, 36px); line-height: 1.15; letter-spacing: -1px; color: #0f172a;">Thanks for registering! 🎉</h1>
    <p style="margin: 0 auto 22px; max-width: 370px; color: #64748b; font-size: 15px; line-height: 1.6;">You're officially on the list. We're excited to have you with us. Get ready for something amazing!</p>
    <div style="padding: 20px 16px; margin-top: 10px; border-radius: 20px; background: linear-gradient(135deg, #eff6ff, #f5f3ff); border: 1px solid #e2e8f0;">
      <div style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Launching on</div>
      <div style="font-size: 24px; font-weight: 800; color: #1d4ed8; margin-top: 2px;">15 August 🚀</div>
      <div class="cnt-grid">
        <div class="cnt-box"><div class="cnt-num" id="cnt-days">00</div><div class="cnt-lbl">Days</div></div>
        <div class="cnt-box"><div class="cnt-num" id="cnt-hours">00</div><div class="cnt-lbl">Hours</div></div>
        <div class="cnt-box"><div class="cnt-num" id="cnt-mins">00</div><div class="cnt-lbl">Mins</div></div>
        <div class="cnt-box"><div class="cnt-num" id="cnt-secs">00</div><div class="cnt-lbl">Secs</div></div>
      </div>
    </div>
    <p style="margin-top: 20px; color: #94a3b8; font-size: 13px;">Stay tuned. We’ll see you at launch!</p>
  </div>

  <script>
    (function() {
      const launchDate = new Date('2026-08-15T00:00:00+05:30').getTime();
      function updateTimer() {
        const now = new Date().getTime();
        const diff = Math.max(0, launchDate - now);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        const dEl = document.getElementById('cnt-days');
        const hEl = document.getElementById('cnt-hours');
        const mEl = document.getElementById('cnt-mins');
        const sEl = document.getElementById('cnt-secs');
        if (dEl) dEl.innerText = String(days).padStart(2, '0');
        if (hEl) hEl.innerText = String(hours).padStart(2, '0');
        if (mEl) mEl.innerText = String(mins).padStart(2, '0');
        if (sEl) sEl.innerText = String(secs).padStart(2, '0');
      }
      updateTimer();
      setInterval(updateTimer, 1000);
    })();
  </script>
</div>`
  },
  {
    name: 'Full-Screen Dark Maintenance Page',
    code: `<div style="min-height: 100vh; width: 100vw; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; text-align: center;">
  <div style="font-size: 3rem; margin-bottom: 16px;">🚀</div>
  <h1 style="font-size: 2rem; font-weight: 800; color: #ffffff; margin: 0 0 12px 0;">Platform Maintenance Underway</h1>
  <p style="font-size: 1rem; color: #94a3b8; max-width: 480px; line-height: 1.6; margin: 0 0 28px 0;">
    Accountize is currently undergoing scheduled infrastructure upgrades. All data remains completely safe.
  </p>
  <a href="mailto:support@accountize.in" style="background: #6366f1; color: #ffffff; padding: 12px 24px; border-radius: 9999px; font-weight: 700; text-decoration: none; font-size: 0.9rem;">
    Contact Support
  </a>
</div>`
  },
  {
    name: 'Simple Warning Banner',
    code: `<div style="text-align: center; padding: 10px;">
  <h3 style="color: #ef4444; font-size: 1.1rem; margin-bottom: 6px; font-weight: 800;">⚡ Server Upgrades in Progress</h3>
  <p style="color: #475569; font-size: 0.85rem; line-height: 1.5; margin: 0;">We are performing routine security and database optimizations. Access will resume shortly.</p>
</div>`
  }
]

function formatTimestamp(ts) {
  if (!ts) return 'Never'
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SystemConfig() {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null) // key being saved
  const [messages, setMessages] = useState({}) // local message/HTML drafts
  const [userNames, setUserNames] = useState({})
  const [confirmModal, setConfirmModal] = useState(null) // { key, label, warning }
  const [previewModal, setPreviewModal] = useState(null) // { title, code }
  const [successToast, setSuccessToast] = useState(null)

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true)
      const [profiles, { data, error }] = await Promise.all([
        fetchUserProfiles(),
        supabase.rpc('admin_get_system_config')
      ])

      if (error) throw error

      const configMap = {}
      const msgMap = {}
      ;(data || []).forEach(row => {
        configMap[row.key] = row
        msgMap[row.key] = row.message || ''
      })
      setConfig(configMap)
      setMessages(msgMap)
      setUserNames(profiles || {})
    } catch (err) {
      console.error('[SystemConfig] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const handleToggle = (serviceDef, currentlyEnabled) => {
    if (currentlyEnabled) {
      // Disabling — show confirmation modal
      setConfirmModal({
        key: serviceDef.key,
        label: serviceDef.label,
        warning: serviceDef.criticalWarning,
        color: serviceDef.color
      })
    } else {
      // Enabling — no confirmation needed
      saveConfig(serviceDef.key, 'true', messages[serviceDef.key] || '')
    }
  }

  const confirmDisable = () => {
    if (confirmModal) {
      saveConfig(confirmModal.key, 'false', messages[confirmModal.key] || '')
      setConfirmModal(null)
    }
  }

  const saveConfig = async (key, value, message) => {
    try {
      setSaving(key)
      const { error } = await supabase.rpc('admin_upsert_system_config', {
        config_key: key,
        config_value: value,
        config_message: message
      })
      if (error) throw error

      // Update local state
      setConfig(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          key,
          value,
          message,
          updated_at: new Date().toISOString(),
          updated_by: null
        }
      }))

      setSuccessToast(`${SERVICE_DEFINITIONS.find(s => s.key === key)?.label || key} updated successfully`)
      setTimeout(() => setSuccessToast(null), 3000)
    } catch (err) {
      console.error('[SystemConfig] Failed to save:', err)
      alert('Failed to update config: ' + (err.message || err))
    } finally {
      setSaving(null)
    }
  }

  const handleSaveMessage = (key) => {
    const currentValue = config[key]?.value || 'true'
    saveConfig(key, currentValue, messages[key] || '')
  }

  const insertSnippet = (key, snippetCode) => {
    setMessages(prev => ({ ...prev, [key]: snippetCode }))
  }

  if (loading) {
    return <LoadingScreen label="Loading System Config..." sublabel="Fetching service control settings" fullScreen={false} />
  }

  const activeCount = SERVICE_DEFINITIONS.filter(s => config[s.key]?.value !== 'false').length
  const blockedCount = SERVICE_DEFINITIONS.length - activeCount

  return (
    <div className="sysconfig-page">
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            <Settings size={22} /> System Config
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Activate or deactivate services with live HTML block code rendering
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadConfig} style={{ borderRadius: 'var(--radius-full)' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Status Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--green)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle size={16} color="var(--green)" />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activeCount}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Services</div>
            </div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--red)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <XCircle size={16} color="var(--red)" />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{blockedCount}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Blocked Services</div>
            </div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--indigo-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={16} color="var(--accent-primary)" />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{SERVICE_DEFINITIONS.length}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Services</div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Control Cards */}
      <div className="sysconfig-grid">
        {SERVICE_DEFINITIONS.map(service => {
          const row = config[service.key] || {}
          const isEnabled = row.value !== 'false'
          const Icon = service.icon
          const isSaving = saving === service.key
          const currentMsg = messages[service.key] || ''
          const isHtml = /<[a-z][\s\S]*>/i.test(currentMsg)
          const updatedBy = row.updated_by ? (userNames[row.updated_by]?.displayName || userNames[row.updated_by]?.email || 'Admin') : null

          return (
            <div
              key={service.key}
              className={`sysconfig-card ${isEnabled ? 'sysconfig-card--active' : 'sysconfig-card--blocked'}`}
            >
              {/* Card Header */}
              <div className="sysconfig-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    className="sysconfig-icon"
                    style={{
                      background: isEnabled ? service.bgColor : 'var(--red-bg)',
                      border: `1.5px solid ${isEnabled ? service.borderColor : 'var(--red-border)'}`
                    }}
                  >
                    <Icon size={20} color={isEnabled ? service.color : 'var(--red)'} />
                  </div>
                  <div>
                    <h3 className="sysconfig-card-title">{service.label}</h3>
                    <p className="sysconfig-card-desc">{service.description}</p>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  className={`sysconfig-toggle ${isEnabled ? 'sysconfig-toggle--on' : 'sysconfig-toggle--off'}`}
                  onClick={() => handleToggle(service, isEnabled)}
                  disabled={isSaving}
                  title={isEnabled ? 'Click to disable' : 'Click to enable'}
                >
                  <div className="sysconfig-toggle-track">
                    <div className="sysconfig-toggle-thumb" />
                  </div>
                  <span className="sysconfig-toggle-label">
                    {isSaving ? 'Saving...' : isEnabled ? 'Active' : 'Blocked'}
                  </span>
                </button>
              </div>

              {/* Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                {isEnabled ? (
                  <span className="badge badge-green" style={{ fontSize: '0.68rem' }}>
                    <span className="sysconfig-pulse sysconfig-pulse--green" /> Operational
                  </span>
                ) : (
                  <span className="badge" style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)', fontSize: '0.68rem' }}>
                    <span className="sysconfig-pulse sysconfig-pulse--red" /> Service Blocked
                  </span>
                )}
                {row.updated_at && (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} /> {formatTimestamp(row.updated_at)}
                    {updatedBy && <> · {updatedBy}</>}
                  </span>
                )}
              </div>

              {/* Block HTML / Message Editor */}
              <div className="sysconfig-message-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label className="sysconfig-message-label" style={{ margin: 0 }}>
                    <Code size={14} color="var(--accent-primary)" /> Block HTML / Message Code
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isHtml ? (
                      <span className="badge" style={{ background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe', fontSize: '0.65rem' }}>
                        HTML Detected
                      </span>
                    ) : (
                      <span className="badge" style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.65rem' }}>
                        Plain Text
                      </span>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setPreviewModal({ title: `${service.label} Block HTML Preview`, code: currentMsg })}
                      style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 'var(--radius-full)' }}
                    >
                      <Eye size={12} /> Preview
                    </button>
                  </div>
                </div>

                {/* HTML Presets Dropdown / Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Wand2 size={11} /> Starter HTML:
                  </span>
                  {HTML_SNIPPETS.map((snippet, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => insertSnippet(service.key, snippet.code)}
                      style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--bg-primary)' }}
                      title="Insert sample HTML template"
                    >
                      + {snippet.name}
                    </button>
                  ))}
                </div>

                <textarea
                  className="sysconfig-textarea"
                  style={{ fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.45 }}
                  placeholder={`Enter HTML code or custom text (e.g. <h3>Under Maintenance</h3><p>We will be back shortly.</p>)`}
                  value={currentMsg}
                  onChange={e => setMessages(prev => ({ ...prev, [service.key]: e.target.value }))}
                  rows={4}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    Renders directly on client screens when service is disabled.
                  </span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSaveMessage(service.key)}
                    disabled={isSaving || currentMsg === (row.message || '')}
                    style={{ borderRadius: 'var(--radius-full)', fontSize: '0.75rem', padding: '6px 16px' }}
                  >
                    <Save size={13} /> Save HTML / Message
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Maintenance Bypass Whitelist Card */}
      <div className="sysconfig-card" style={{ marginTop: 20, borderTop: '3px solid var(--purple)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="sysconfig-icon" style={{ background: 'var(--purple-bg)', border: '1.5px solid var(--purple-border)' }}>
              <Shield size={20} color="var(--purple)" />
            </div>
            <div>
              <h3 className="sysconfig-card-title">Maintenance Bypass Whitelist</h3>
              <p className="sysconfig-card-desc">Exempt specific user emails or User IDs (UUIDs) from service maintenance blocks.</p>
            </div>
          </div>
          <span className="badge" style={{ background: 'var(--purple-bg)', color: 'var(--purple)', border: '1px solid var(--purple-border)', fontSize: '0.68rem' }}>
            Admin Whitelist
          </span>
        </div>

        <div className="sysconfig-message-section" style={{ borderTop: 'none', paddingTop: 0, marginTop: 8 }}>
          <label className="sysconfig-message-label">
            Exempt Emails / User IDs (comma-separated)
          </label>
          <textarea
            className="sysconfig-textarea"
            style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
            placeholder="e.g. vip@accountize.in, tester@gmail.com, 7a3c8e1d-4b92-4f81-9b10..."
            value={messages['bypass_users'] ?? (config['bypass_users']?.value || config['bypass_users']?.message || '')}
            onChange={e => setMessages(prev => ({ ...prev, bypass_users: e.target.value }))}
            rows={3}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              💡 Super Admin domains (<code>@inexarum.com</code>, <code>@inexarum.in</code>) are automatically bypassed.
            </span>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const val = messages['bypass_users'] ?? (config['bypass_users']?.value || config['bypass_users']?.message || '')
                saveConfig('bypass_users', val, val)
              }}
              disabled={saving === 'bypass_users'}
              style={{ borderRadius: 'var(--radius-full)', fontSize: '0.75rem', padding: '6px 16px', background: 'var(--purple)', borderColor: 'var(--purple)' }}
            >
              <Save size={13} /> Save Whitelist
            </button>
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div style={{
        marginTop: 20, padding: '14px 18px', background: 'var(--blue-bg)', border: '1px solid var(--blue-border)',
        borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: '0.78rem', color: 'var(--text-secondary)'
      }}>
        <FileCode size={18} color="var(--blue)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Rich HTML & Whitelist Support:</strong> You can enter inline styles, headings (<code>&lt;h3&gt;</code>), links (<code>&lt;a&gt;</code>), and buttons into the block code editor. Whitelisted users will bypass maintenance screens automatically.
        </div>
      </div>

      {/* Live HTML Preview Modal */}
      {previewModal && (
        <div className="sysconfig-modal-overlay" onClick={() => setPreviewModal(null)}>
          <div className="sysconfig-modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Eye size={18} color="var(--accent-primary)" /> {previewModal.title}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setPreviewModal(null)} style={{ borderRadius: '50%', width: 28, height: 28, padding: 0 }}>✕</button>
            </div>
            
            <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 18, background: '#f8fafc', minHeight: 120 }}>
              {previewModal.code ? (
                <div dangerouslySetInnerHTML={{ __html: previewModal.code }} />
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', fontStyle: 'italic', padding: 20 }}>
                  No HTML content entered yet.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setPreviewModal(null)} style={{ borderRadius: 'var(--radius-full)' }}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="sysconfig-modal-overlay" onClick={() => setConfirmModal(null)}>
          <div className="sysconfig-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} color="var(--red)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Disable {confirmModal.label}?
                </h3>
              </div>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
              {confirmModal.warning}
            </p>
            <div style={{
              padding: '10px 14px', background: 'var(--amber-bg)', border: '1px solid var(--amber-border)',
              borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: '#92400e', marginBottom: 16
            }}>
              ⚠️ This action affects <strong>all users</strong> immediately on their next page load.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 'var(--radius-full)', padding: '8px 20px', fontWeight: 700, cursor: 'pointer' }}
                onClick={confirmDisable}
              >
                Disable {confirmModal.label}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {successToast && (
        <div className="sysconfig-toast">
          <CheckCircle size={16} color="var(--green)" />
          {successToast}
        </div>
      )}
    </div>
  )
}
