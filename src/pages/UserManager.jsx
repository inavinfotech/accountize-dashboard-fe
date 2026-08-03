import { useState, useEffect, useMemo } from 'react'
import { supabase, fetchUserProfiles } from '../lib/supabase'
import {
  Users, Search, RefreshCw, Shield, Award, Ban, UserCheck,
  TrendingUp, Activity, CheckCircle, Eye, FileText, Share2, Layers
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

const TIER_COLORS = {
  'Starter Free': '#3b82f6',
  'Pro Trial': '#8b5cf6',
  'Pro Plan (Paid)': '#10b981',
  'Collab Plan': '#f59e0b'
}

export default function UserManager() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [userNames, setUserNames] = useState({})
  const [selectedUser, setSelectedUser] = useState(null)
  const [dateRange, setDateRange] = useState('30d') // '7d' or '30d'

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      setLoading(true)
      const profiles = await fetchUserProfiles()
      const nameMap = {}
      const userMap = new Map()

      // 1. Seed userMap with ALL registered users from user_profiles
      Object.entries(profiles).forEach(([uid, p]) => {
        nameMap[uid] = {
          displayName: p.displayName,
          email: p.email
        }
        userMap.set(uid, {
          id: uid,
          email: p.email || null,
          displayName: p.displayName,
          created_at: p.created_at || new Date().toISOString(),
          tier: 'Starter Free',
          status: 'active',
          accountsCount: 0,
          eventsCount: 0,
          lastSeen: p.created_at || new Date().toISOString()
        })
      })
      setUserNames(nameMap)

      // Query distinct user_ids from accounts & analytics_events table to enrich stats
      const { data: accountsData } = await supabase.from('accounts').select('user_id, created_at, name')
      const { data: eventsData } = await supabase.from('analytics_events').select('user_id, created_at, event_name')

      // Aggregate user accounts
      if (accountsData) {
        accountsData.forEach(item => {
          if (!item.user_id) return
          if (!userMap.has(item.user_id)) {
            userMap.set(item.user_id, {
              id: item.user_id,
              email: null,
              displayName: item.name || `User #${item.user_id.slice(0, 8)}`,
              created_at: item.created_at,
              tier: 'Pro Trial',
              status: 'active',
              accountsCount: 1,
              eventsCount: 0,
              lastSeen: item.created_at
            })
          } else {
            const u = userMap.get(item.user_id)
            u.accountsCount += 1
            if (u.tier === 'Starter Free') u.tier = 'Pro Trial'
            if (new Date(item.created_at) > new Date(u.lastSeen)) {
              u.lastSeen = item.created_at
            }
          }
        })
      }

      // Aggregate user activity events
      if (eventsData) {
        eventsData.forEach(item => {
          if (!item.user_id) return
          if (!userMap.has(item.user_id)) {
            userMap.set(item.user_id, {
              id: item.user_id,
              email: null,
              displayName: `User #${item.user_id.slice(0, 8)}`,
              created_at: item.created_at,
              tier: 'Starter Free',
              status: 'active',
              accountsCount: 0,
              eventsCount: 1,
              lastSeen: item.created_at
            })
          } else {
            const u = userMap.get(item.user_id)
            u.eventsCount += 1
            if (new Date(item.created_at) > new Date(u.lastSeen)) {
              u.lastSeen = item.created_at
            }
          }
        })
      }

      setUsers(Array.from(userMap.values()))
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleTierChange = (userId, newTier) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier: newTier } : u))
  }

  const handleToggleStatus = (userId) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const nextStatus = u.status === 'active' ? 'suspended' : 'active'
        return { ...u, status: nextStatus }
      }
      return u
    }))
  }

  // ── Analytics & Visualizations Computation ──────────────────────────
  const insights = useMemo(() => {
    const totalUsers = users.length
    const activeUsers = users.filter(u => u.status === 'active').length
    const suspendedUsers = totalUsers - activeUsers
    const proUsers = users.filter(u => u.tier.includes('Pro') || u.tier.includes('Collab')).length

    // Active Today (users whose lastSeen is today)
    const todayStr = new Date().toISOString().split('T')[0]
    const activeToday = users.filter(u => new Date(u.lastSeen).toISOString().split('T')[0] === todayStr).length

    // User Growth Trend Chart (Cumulative Signups Over 30 Days)
    const now = new Date()
    const days = dateRange === '7d' ? 7 : 30
    const growthTrend = []

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dStr = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      const signups = users.filter(u => new Date(u.created_at).toISOString().split('T')[0] === dStr).length
      growthTrend.push({ date: label, NewUsers: signups })
    }

    // Tier Breakdown Donut Chart
    const tierCounts = {}
    users.forEach(u => {
      tierCounts[u.tier] = (tierCounts[u.tier] || 0) + 1
    })
    const tierBreakdown = Object.entries(tierCounts).map(([name, value]) => ({
      name,
      value,
      color: TIER_COLORS[name] || '#6366f1'
    }))

    // Top Most Active Users Bar Chart
    const topActiveUsers = [...users]
      .sort((a, b) => b.eventsCount - a.eventsCount)
      .slice(0, 6)
      .map(u => {
        const nameInfo = userNames[u.id]
        const displayName = nameInfo?.displayName || `User #${u.id.slice(0, 6)}`
        return {
          name: displayName.length > 18 ? displayName.substring(0, 18) + '...' : displayName,
          events: u.eventsCount,
          userId: u.id
        }
      })

    return {
      totalUsers, activeUsers, suspendedUsers, proUsers, activeToday,
      growthTrend, tierBreakdown, topActiveUsers
    }
  }, [users, dateRange, userNames])

  const filteredUsers = users.filter(u => {
    const profile = userNames[u.id]
    const displayName = (profile?.displayName || '').toLowerCase()
    const email = (profile?.email || '').toLowerCase()
    const query = searchQuery.toLowerCase().trim()

    return !query || u.id.toLowerCase().includes(query) ||
      u.tier.toLowerCase().includes(query) ||
      displayName.includes(query) ||
      email.includes(query)
  })

  return (
    <div className="animate-in">
      {/* ── Title & Refresh ──────────────────────────────────────────────── */}
      <div className="page-title-row">
        <div>
          <h1 className="page-title">User &amp; Subscription Tier Governance</h1>
          <p className="page-desc">Manage registered user tiers, trials, activity insights, and access controls</p>
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
          <button className="btn btn-secondary" onClick={loadUsers} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Users
          </button>
        </div>
      </div>

      {/* ── SECTION 1: KPI SCORECARDS ────────────────────────────────────── */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Platform Users</span>
            <div className="metric-icon badge-indigo"><Users size={18} /></div>
          </div>
          <div className="metric-value">{insights.totalUsers}</div>
          <div className="metric-subtext">Registered user accounts</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Active Today</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#10b981',
                boxShadow: '0 0 10px #10b981', display: 'inline-block'
              }} className="animate-pulse" />
              <div className="metric-icon badge-green"><UserCheck size={18} /></div>
            </div>
          </div>
          <div className="metric-value">{insights.activeToday}</div>
          <div className="metric-subtext">Active in last 24h</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Pro &amp; Collab Tiers</span>
            <div className="metric-icon badge-purple"><Award size={18} /></div>
          </div>
          <div className="metric-value">{insights.proUsers}</div>
          <div className="metric-subtext">
            {insights.totalUsers > 0 ? Math.round((insights.proUsers / insights.totalUsers) * 100) : 0}% tier adoption
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Suspended Accounts</span>
            <div className="metric-icon badge-rose"><Ban size={18} /></div>
          </div>
          <div className="metric-value" style={{ color: insights.suspendedUsers > 0 ? 'var(--red)' : 'var(--text-primary)' }}>
            {insights.suspendedUsers}
          </div>
          <div className="metric-subtext">{insights.activeUsers} active accounts</div>
        </div>
      </div>

      {/* ── SECTION 2: USER GROWTH TREND CHART ───────────────────────────── */}
      <div className="table-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>New User Registration Rate</h3>
            <p className="metric-subtext" style={{ margin: 0 }}>Daily new user signups over time</p>
          </div>
          <span className="badge badge-indigo">{dateRange === '7d' ? '7-Day Trend' : '30-Day Trend'}</span>
        </div>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={insights.growthTrend}>
              <defs>
                <linearGradient id="userGrowth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<SlateTooltip />} />
              <Area type="monotone" dataKey="NewUsers" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#userGrowth)" name="New Users" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── SECTION 3: TIER BREAKDOWN & MOST ACTIVE USERS (2-Column Grid) ── */}
      <div className="insights-grid" style={{ marginBottom: 24 }}>
        {/* Tier Breakdown Donut Chart */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Subscription Tier Distribution</h3>
              <p className="metric-subtext" style={{ margin: 0 }}>Active tier plans breakdown</p>
            </div>
            <span className="badge badge-purple"><Shield size={12} /> Tiers</span>
          </div>
          <div className="donut-card-body">
            <div style={{ width: 150, height: 150, flexShrink: 0 }}>
              {insights.tierBreakdown.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No tier data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={insights.tierBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={40} outerRadius={66}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={2}
                    >
                      {insights.tierBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<SlateTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="donut-legend">
              {insights.tierBreakdown.map((entry, i) => (
                <div key={i} className="donut-legend-item">
                  <span className="donut-legend-dot" style={{ background: entry.color }} />
                  <span className="donut-legend-label">{entry.name}</span>
                  <span className="donut-legend-value">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Most Active Users Bar Chart */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Most Active Users</h3>
              <p className="metric-subtext" style={{ margin: 0 }}>Users with highest platform engagement</p>
            </div>
            <span className="badge badge-green"><Activity size={12} /> Engagement</span>
          </div>
          <div style={{ width: '100%', height: 220 }}>
            {insights.topActiveUsers.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No user activity data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.topActiveUsers} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#475569" fontSize={10} width={110} tickLine={false} />
                  <Tooltip content={<SlateTooltip />} />
                  <Bar dataKey="events" radius={[0, 6, 6, 0]} name="Events Count">
                    {insights.topActiveUsers.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#6366f1' : i === 1 ? '#818cf8' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: MAIN USER REGISTRY TABLE ──────────────────────────── */}
      <div className="table-card">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={18} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Active Platform Accounts ({filteredUsers.length})</span>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: 34 }}
              placeholder="Search user name, email, ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading user registry...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No registered users found.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User Identity</th>
                  <th>Subscription Tier</th>
                  <th>Status</th>
                  <th>Ledgers</th>
                  <th>Events</th>
                  <th>Last Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
                  const profile = userNames[u.id]
                  const displayName = profile?.displayName || `User #${u.id.slice(0, 8)}`
                  const email = profile?.email

                  return (
                    <tr key={u.id}>
                      <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'var(--accent-gradient)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.8rem', flexShrink: 0
                          }}>
                            {displayName[0]?.toUpperCase() || 'U'}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                              {displayName}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {email ? email : `ID: ${u.id.slice(0, 12)}...`}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <select
                          value={u.tier}
                          onChange={e => handleTierChange(u.id, e.target.value)}
                          style={{
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            outline: 'none'
                          }}
                        >
                          <option value="Starter Free">Starter Free</option>
                          <option value="Pro Trial">Pro Plan (Trial)</option>
                          <option value="Pro Plan (Paid)">Pro Plan (Paid)</option>
                          <option value="Collab Plan">Collab Plan</option>
                        </select>
                      </td>
                      <td>
                        {u.status === 'active' ? (
                          <span className="badge badge-green"><CheckCircle size={10} /> Active</span>
                        ) : (
                          <span className="badge badge-rose"><Ban size={10} /> Suspended</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        <span className="badge badge-blue">{u.accountsCount}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        <span className="badge badge-purple">{u.eventsCount}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(u.lastSeen).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedUser(u)}>
                            <Eye size={12} /> Inspect
                          </button>
                          <button
                            className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => handleToggleStatus(u.id)}
                          >
                            {u.status === 'active' ? <><Ban size={12} /> Suspend</> : 'Unsuspend'}
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

      {/* ── User Inspect Modal ───────────────────────────────────────────── */}
      {selectedUser && (
        <div className="modal-backdrop animate-in" onClick={() => setSelectedUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 'min(640px, 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: 'var(--accent-gradient)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '1rem'
                }}>
                  {(userNames[selectedUser.id]?.displayName || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                    {userNames[selectedUser.id]?.displayName || `User #${selectedUser.id.slice(0, 8)}`}
                  </h3>
                  <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {userNames[selectedUser.id]?.email || selectedUser.id}
                  </div>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedUser(null)}>✕ Close</button>
            </div>

            {/* Quick Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{selectedUser.tier}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Tier</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#3b82f6' }}>{selectedUser.accountsCount}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Ledger Accounts</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#8b5cf6' }}>{selectedUser.eventsCount}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Events</div>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.6 }}>
              <div><strong>Status:</strong> {selectedUser.status === 'active' ? 'Active Account' : 'Suspended Account'}</div>
              <div><strong>First Registered:</strong> {new Date(selectedUser.created_at).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</div>
              <div><strong>Last Activity:</strong> {new Date(selectedUser.lastSeen).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button
                className={`btn ${selectedUser.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => {
                  handleToggleStatus(selectedUser.id)
                  setSelectedUser(prev => prev ? { ...prev, status: prev.status === 'active' ? 'suspended' : 'active' } : null)
                }}
              >
                {selectedUser.status === 'active' ? 'Suspend Account' : 'Unsuspend Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
