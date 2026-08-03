import { useState, useEffect, useMemo } from 'react'
import { supabase, fetchUserProfiles } from '../lib/supabase'
import {
  ShieldCheck, Share2, RefreshCw, Trash2, Search, Link2, Clock,
  Eye, TrendingUp, BarChart2, PieChart as PieIcon, Copy, Check
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts'

// Custom Slate Tooltip
function SlateTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      fontSize: '0.8rem', color: '#0f172a'
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ color: '#475569' }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

const AGE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b']

function formatAge(dateString) {
  const diffMs = new Date().getTime() - new Date(dateString).getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export default function Governance() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [userNames, setUserNames] = useState({})
  const [selectedLink, setSelectedLink] = useState(null)
  const [copiedToken, setCopiedToken] = useState(null)
  const [dateRange, setDateRange] = useState('30d')

  useEffect(() => {
    loadSharedLinks()
  }, [])

  async function loadSharedLinks() {
    try {
      setLoading(true)
      const profiles = await fetchUserProfiles()
      const map = {}
      Object.entries(profiles).forEach(([uid, p]) => {
        map[uid] = p
      })
      setUserNames(map)

      const { data, error } = await supabase
        .from('shared_links')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setLinks(data || [])
    } catch (err) {
      console.error('Failed to load shared links:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeToken = async (linkId) => {
    try {
      const { error } = await supabase.from('shared_links').delete().eq('id', linkId)
      if (error) throw error
      setLinks(prev => prev.filter(item => item.id !== linkId))
      if (selectedLink?.id === linkId) setSelectedLink(null)
    } catch (err) {
      console.error('Failed to revoke shared link:', err)
    }
  }

  const handleCopy = (token) => {
    navigator.clipboard.writeText(token)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  // ── Analytics Computation ───────────────────────────────────────────
  const insights = useMemo(() => {
    const totalLinks = links.length

    // Unique owners
    const uniqueOwners = new Set(links.map(l => l.user_id).filter(Boolean)).size

    // Created Today
    const todayStr = new Date().toISOString().split('T')[0]
    const createdToday = links.filter(l => new Date(l.created_at).toISOString().split('T')[0] === todayStr).length

    // Avg links per user
    const avgPerOwner = uniqueOwners > 0 ? (totalLinks / uniqueOwners).toFixed(1) : 0

    // Token Creation Trend Chart
    const now = new Date()
    const days = dateRange === '7d' ? 7 : 30
    const trendData = []

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dStr = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      const count = links.filter(l => new Date(l.created_at).toISOString().split('T')[0] === dStr).length
      trendData.push({ date: label, TokensCreated: count })
    }

    // Tokens Per Owner (Bar Chart)
    const ownerCounts = {}
    links.forEach(l => {
      const uid = l.user_id || 'unknown'
      ownerCounts[uid] = (ownerCounts[uid] || 0) + 1
    })

    const topOwners = Object.entries(ownerCounts)
      .map(([uid, count]) => {
        const displayName = userNames[uid]?.displayName || (uid !== 'unknown' ? `User #${uid.slice(0, 8)}` : 'Unknown User')
        return {
          name: displayName.length > 18 ? displayName.substring(0, 18) + '...' : displayName,
          count,
          uid
        }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // Token Age Breakdown (Donut Chart)
    let lessThan1d = 0, oneTo7d = 0, sevenTo30d = 0, thirtyPlusD = 0
    const nowMs = now.getTime()

    links.forEach(l => {
      const ageMs = nowMs - new Date(l.created_at).getTime()
      const ageDays = ageMs / (1000 * 60 * 60 * 24)
      if (ageDays < 1) lessThan1d++
      else if (ageDays < 7) oneTo7d++
      else if (ageDays < 30) sevenTo30d++
      else thirtyPlusD++
    })

    const ageBreakdown = [
      { name: '< 24 Hours', value: lessThan1d, color: AGE_COLORS[0] },
      { name: '1 – 7 Days', value: oneTo7d, color: AGE_COLORS[1] },
      { name: '7 – 30 Days', value: sevenTo30d, color: AGE_COLORS[2] },
      { name: '30+ Days', value: thirtyPlusD, color: AGE_COLORS[3] },
    ].filter(b => b.value > 0)

    return {
      totalLinks, uniqueOwners, createdToday, avgPerOwner,
      trendData, topOwners, ageBreakdown
    }
  }, [links, dateRange, userNames])

  const filteredLinks = links.filter(l => {
    const query = searchQuery.toLowerCase().trim()
    const tokenStr = String(l.token || '').toLowerCase()
    const uidStr = String(l.user_id || '').toLowerCase()
    const ownerName = String(userNames[l.user_id]?.displayName || '').toLowerCase()

    return !query || tokenStr.includes(query) || uidStr.includes(query) || ownerName.includes(query)
  })

  return (
    <div className="animate-in">
      {/* ── Title & Refresh ──────────────────────────────────────────────── */}
      <div className="page-title-row">
        <div>
          <h1 className="page-title">Shared Token &amp; Anti-Fraud Audit</h1>
          <p className="page-desc">Audit active public shared ledger tokens, analyze token lifecycles, and revoke compromised links</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="range-selector">
            {['7d', '30d'].map(r => (
              <button
                key={r}
                className={`range-btn ${dateRange === r ? 'active' : ''}`}
                onClick={() => setDateRange(r)}
              >
                {r === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={loadSharedLinks} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Links
          </button>
        </div>
      </div>

      {/* ── SECTION 1: KPI SCORECARDS ────────────────────────────────────── */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Active Shared Tokens</span>
            <div className="metric-icon badge-indigo"><Link2 size={18} /></div>
          </div>
          <div className="metric-value">{insights.totalLinks}</div>
          <div className="metric-subtext">Public shared ledger links</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Unique Token Owners</span>
            <div className="metric-icon badge-blue"><Share2 size={18} /></div>
          </div>
          <div className="metric-value">{insights.uniqueOwners}</div>
          <div className="metric-subtext">Distinct accounts sharing links</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Generated Today</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {insights.createdToday > 0 && (
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#10b981',
                  boxShadow: '0 0 10px #10b981', display: 'inline-block'
                }} className="animate-pulse" />
              )}
              <div className="metric-icon badge-green"><TrendingUp size={18} /></div>
            </div>
          </div>
          <div className="metric-value">{insights.createdToday}</div>
          <div className="metric-subtext">New token creations</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Avg. Tokens / User</span>
            <div className="metric-icon badge-amber"><BarChart2 size={18} /></div>
          </div>
          <div className="metric-value">{insights.avgPerOwner}</div>
          <div className="metric-subtext">Tokens per active owner</div>
        </div>
      </div>

      {/* ── SECTION 2: TOKEN CREATION TREND ─────────────────────────────── */}
      <div className="table-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Token Creation Velocity</h3>
            <p className="metric-subtext" style={{ margin: 0 }}>Public ledger token generation frequency over time</p>
          </div>
          <span className="badge badge-amber">{dateRange === '7d' ? '7-Day Overview' : '30-Day Overview'}</span>
        </div>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={insights.trendData}>
              <defs>
                <linearGradient id="tokenTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<SlateTooltip />} />
              <Area type="monotone" dataKey="TokensCreated" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#tokenTrend)" name="Tokens Generated" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── SECTION 3: TOP OWNERS & TOKEN AGE BREAKDOWN (2-Column Grid) ──── */}
      <div className="insights-grid" style={{ marginBottom: 24 }}>
        {/* Top Token Creators Bar Chart */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Top Sharing Accounts</h3>
              <p className="metric-subtext" style={{ margin: 0 }}>Users with highest active shared links</p>
            </div>
            <span className="badge badge-blue"><Share2 size={12} /> Creators</span>
          </div>
          <div style={{ width: '100%', height: 220 }}>
            {insights.topOwners.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No active shared links
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.topOwners} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#475569" fontSize={10} width={110} tickLine={false} />
                  <Tooltip content={<SlateTooltip />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Shared Links">
                    {insights.topOwners.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#f59e0b' : i === 1 ? '#6366f1' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Token Age Breakdown Donut Chart */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Token Age Distribution</h3>
              <p className="metric-subtext" style={{ margin: 0 }}>Lifecycle duration of active tokens</p>
            </div>
            <span className="badge badge-indigo"><Clock size={12} /> Age</span>
          </div>
          <div className="donut-card-body">
            <div style={{ width: 150, height: 150, flexShrink: 0 }}>
              {insights.ageBreakdown.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={insights.ageBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={40} outerRadius={66}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={2}
                    >
                      {insights.ageBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<SlateTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="donut-legend">
              {insights.ageBreakdown.map((entry, i) => (
                <div key={i} className="donut-legend-item">
                  <span className="donut-legend-dot" style={{ background: entry.color }} />
                  <span className="donut-legend-label">{entry.name}</span>
                  <span className="donut-legend-value">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: MAIN TOKEN TABLE ──────────────────────────────────── */}
      <div className="table-card">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link2 size={18} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Active Shared Token Links ({filteredLinks.length})</span>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: 34 }}
              placeholder="Search token, owner name, user ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading active shared ledger links...
          </div>
        ) : filteredLinks.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No active shared ledger tokens generated yet.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Shared Token</th>
                  <th>Owner Identity</th>
                  <th>Account ID</th>
                  <th>Age</th>
                  <th>Generated At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLinks.map(l => {
                  const ownerName = userNames[l.user_id]?.displayName || (l.user_id ? `User #${l.user_id.slice(0, 8)}` : 'Unknown Owner')

                  return (
                    <tr key={l.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{l.token}</span>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px', fontSize: '0.65rem' }}
                            onClick={() => handleCopy(l.token)}
                            title="Copy token string"
                          >
                            {copiedToken === l.token ? <Check size={10} color="var(--green)" /> : <Copy size={10} />}
                          </button>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                            {ownerName}
                          </span>
                          {l.user_id && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              ID: {l.user_id.slice(0, 12)}...
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {l.account_id ? l.account_id.slice(0, 16) + '...' : 'Global'}
                      </td>
                      <td>
                        <span className="badge badge-amber">{formatAge(l.created_at)}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(l.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLink(l)}>
                            <Eye size={12} /> Inspect
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleRevokeToken(l.id)}>
                            <Trash2 size={12} /> Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Token Details Modal ──────────────────────────────────────────── */}
      {selectedLink && (
        <div className="modal-backdrop animate-in" onClick={() => setSelectedLink(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 'min(640px, 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Link2 size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Shared Token Audit Inspector</h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLink(null)}>✕ Close</button>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: 14 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
                Public Shared Token Key
              </div>
              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)', wordBreak: 'break-all', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{selectedLink.token}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => handleCopy(selectedLink.token)}>
                  {copiedToken === selectedLink.token ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, lineHeight: 1.6 }}>
              <div>
                <strong>Owner Identity:</strong> {userNames[selectedLink.user_id]?.displayName || (selectedLink.user_id ? `User #${selectedLink.user_id}` : 'Unknown Owner')}
              </div>
              <div>
                <strong>Linked Account ID:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedLink.account_id || 'N/A'}</span>
              </div>
              <div>
                <strong>Created At:</strong> {new Date(selectedLink.created_at).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium' })}
              </div>
              <div>
                <strong>Age:</strong> {formatAge(selectedLink.created_at)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-danger" onClick={() => handleRevokeToken(selectedLink.id)}>
                <Trash2 size={14} /> Revoke &amp; Delete Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
