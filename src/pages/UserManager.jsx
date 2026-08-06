import { useState, useEffect, useMemo } from 'react'
import { supabase, fetchUserProfiles } from '../lib/supabase'
import LoadingScreen from '../components/LoadingScreen'
import {
  Users, UserCheck, ShieldAlert, ShieldCheck, Mail, Search,
  Filter, Calendar, ExternalLink, AlertTriangle, ArrowUpRight, Lock, Key, RefreshCw, Shield, Award, Ban,
  TrendingUp, Activity, CheckCircle, Eye, FileText, Share2, Layers, Trash2
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
  'Pro Plan (Paid)': '#10b981'
}

export default function UserManager() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [userNames, setUserNames] = useState({})
  const [selectedUser, setSelectedUser] = useState(null)
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null)
  const [tierConfirmData, setTierConfirmData] = useState(null)
  const [deletingUserId, setDeletingUserId] = useState(null)
  const [savingTier, setSavingTier] = useState(false)
  const [dateRange, setDateRange] = useState('30d') // '7d' or '30d'

  const handleDeleteUser = async (userObj) => {
    if (!userObj) return
    const userId = userObj.id
    setDeletingUserId(userId)
    try {
      // 1. Invoke RPC function admin_delete_user_data
      const { error: rpcErr } = await supabase.rpc('admin_delete_user_data', { target_user_id: userId })

      // 2. Perform direct table cleanup fallbacks in case RPC is not deployed yet
      if (rpcErr) {
        console.warn('RPC admin_delete_user_data error, applying fallback table deletes:', rpcErr)
        const { data: userAccounts } = await supabase.from('accounts').select('id').eq('user_id', userId)
        const accountIds = userAccounts?.map(a => a.id) || []

        if (accountIds.length > 0) {
          await supabase.from('transactions').delete().in('account_id', accountIds)
          await supabase.from('shared_links').delete().in('account_id', accountIds)
        }
        await supabase.from('expenses').delete().eq('user_id', userId)
        await supabase.from('shared_links').delete().eq('user_id', userId)
        await supabase.from('accounts').delete().eq('user_id', userId)
        await supabase.from('subscriptions').delete().eq('user_id', userId)
        await supabase.from('referrals').delete().or(`referrer_id.eq.${userId},referred_id.eq.${userId}`)
        await supabase.from('analytics_events').delete().eq('user_id', userId)
      }

      // 3. Remove user from local state
      setUsers(prev => prev.filter(u => u.id !== userId))
      if (selectedUser?.id === userId) setSelectedUser(null)
      setDeleteConfirmUser(null)
    } catch (err) {
      console.error('Failed to delete user:', err)
    } finally {
      setDeletingUserId(null)
    }
  }

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

      // Query subscriptions table via admin RPC (bypasses RLS) with fallback
      let subsData = null
      const { data: rpcSubs, error: rpcError } = await supabase.rpc('admin_get_all_subscriptions')
      if (!rpcError && rpcSubs) {
        subsData = rpcSubs
      } else {
        const { data: tableSubs } = await supabase.from('subscriptions').select('*')
        subsData = tableSubs
      }

      if (subsData) {
        subsData.forEach(sub => {
          if (userMap.has(sub.user_id)) {
            const u = userMap.get(sub.user_id)
            if (sub.status === 'suspended') {
              u.status = 'suspended'
            } else {
              u.status = 'active'
            }
            if (sub.status === 'trialing') u.tier = 'Pro Trial'
            else if (sub.plan === 'pro') u.tier = 'Pro Plan (Paid)'
            else u.tier = 'Starter Free'
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

  const executeTierChange = async () => {
    if (!tierConfirmData) return
    const { user: userObj, targetTier, tenure, trialDays } = tierConfirmData
    const userId = userObj.id
    setSavingTier(true)

    let plan = 'free'
    let status = 'active'
    let billingCycle = null
    let trialEnds = null
    let periodStart = new Date().toISOString()
    let periodEnd = null

    if (targetTier === 'Pro Plan (Paid)') {
      plan = 'pro'
      status = 'active'
      billingCycle = tenure === 'annual' ? 'annual' : (tenure === 'lifetime' ? 'annual' : 'monthly')
      const now = new Date()
      if (tenure === 'monthly') {
        now.setMonth(now.getMonth() + 1)
      } else if (tenure === 'annual') {
        now.setFullYear(now.getFullYear() + 1)
      } else if (tenure === 'lifetime') {
        now.setFullYear(now.getFullYear() + 100)
      }
      periodEnd = now.toISOString()
    } else if (targetTier === 'Pro Trial') {
      plan = 'free'
      status = 'trialing'
      billingCycle = 'monthly'
      const now = new Date()
      const days = parseInt(trialDays) || 30
      now.setDate(now.getDate() + days)
      trialEnds = now.toISOString()
      periodEnd = now.toISOString()
    } else {
      plan = 'free'
      status = 'active'
      billingCycle = null
      periodEnd = null
      trialEnds = null
    }

    try {
      const { error: rpcErr } = await supabase.rpc('admin_update_user_subscription', {
        target_user_id: userId,
        new_plan: plan,
        new_status: status,
        new_billing_cycle: billingCycle,
        new_current_period_start: periodStart,
        new_current_period_end: periodEnd,
        new_trial_ends_at: trialEnds
      })

      if (rpcErr) {
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          plan,
          status,
          billing_cycle: billingCycle,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          trial_ends_at: trialEnds,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
      }

      setTierConfirmData(null)
      await loadUsers()
    } catch (err) {
      console.error('Failed to update user plan tier:', err)
    } finally {
      setSavingTier(false)
    }
  }

  const handleToggleStatus = async (userId) => {
    const userObj = users.find(u => u.id === userId)
    if (!userObj) return

    const nextStatus = userObj.status === 'active' ? 'suspended' : 'active'

    // Optimistic UI update
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: nextStatus } : u))

    try {
      let plan = userObj.tier.includes('Pro') ? 'pro' : 'free'
      const { error: rpcErr } = await supabase.rpc('admin_update_user_subscription', {
        target_user_id: userId,
        new_plan: plan,
        new_status: nextStatus,
        new_trial_ends_at: null
      })

      if (rpcErr) {
        console.error('Failed to update user subscription status via RPC:', rpcErr)
      }
    } catch (err) {
      console.error('Failed to update user suspension status:', err)
    }
  }

  // ── Analytics & Visualizations Computation ──────────────────────────
  const insights = useMemo(() => {
    const totalUsers = users.length
    const activeUsers = users.filter(u => u.status === 'active').length
    const suspendedUsers = totalUsers - activeUsers
    const proUsers = users.filter(u => u.tier.includes('Pro')).length

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
          <LoadingScreen fullScreen={false} label="Loading User Registry..." sublabel="Fetching accounts & subscription statuses" />
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
                  <th style={{ textAlign: 'right', minWidth: 220 }}>Actions</th>
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
                          onChange={e => {
                            const newTier = e.target.value
                            if (newTier !== u.tier) {
                              setTierConfirmData({
                                user: u,
                                targetTier: newTier,
                                tenure: 'monthly',
                                trialDays: 30
                              })
                            }
                          }}
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
                      <td style={{ minWidth: 220, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedUser(u)}>
                            <Eye size={12} /> Inspect
                          </button>
                          <button
                            className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => handleToggleStatus(u.id)}
                          >
                            {u.status === 'active' ? <><Ban size={12} /> Suspend</> : 'Unsuspend'}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            onClick={() => setDeleteConfirmUser(u)}
                            title="Delete User & Data"
                          >
                            <Trash2 size={12} /> Delete
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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 20 }}>
              <button
                className="btn btn-secondary"
                style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                onClick={() => setDeleteConfirmUser(selectedUser)}
              >
                <Trash2 size={14} /> Delete Account &amp; All Data
              </button>
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

      {/* ── User Delete Confirmation Modal ────────────────────────────────────── */}
      {deleteConfirmUser && (
        <div className="modal-backdrop animate-in" onClick={() => setDeleteConfirmUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: '#fee2e2',
                color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Permanently Delete User Account?
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  This action is irreversible and purges all user data.
                </p>
              </div>
            </div>

            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '12px 16px', fontSize: '0.825rem', color: '#991b1b', marginBottom: 16,
              lineHeight: 1.5
            }}>
              <div><strong>Target Account:</strong> {userNames[deleteConfirmUser.id]?.displayName || deleteConfirmUser.displayName || 'User'}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', marginTop: 2 }}>{userNames[deleteConfirmUser.id]?.email || deleteConfirmUser.id}</div>
              <hr style={{ border: 'none', borderTop: '1px solid #fca5a5', margin: '10px 0' }} />
              <div>The following data will be permanently wiped:</div>
              <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: '0.78rem' }}>
                <li>All bank &amp; cash accounts ({deleteConfirmUser.accountsCount} created)</li>
                <li>All logged transactions &amp; expenses</li>
                <li>All shared cryptographic ledger links</li>
                <li>Subscription tier &amp; referral history</li>
                <li>Authentication credentials &amp; login metadata</li>
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteConfirmUser(null)}
                disabled={deletingUserId === deleteConfirmUser.id}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={() => handleDeleteUser(deleteConfirmUser)}
                disabled={deletingUserId === deleteConfirmUser.id}
              >
                {deletingUserId === deleteConfirmUser.id ? (
                  <div className="loading-spinner" style={{ width: 14, height: 14 }} />
                ) : (
                  <><Trash2 size={14} /> Permanently Delete User</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Subscription Plan Change Re-Verification Modal ───────────────────── */}
      {tierConfirmData && (
        <div className="modal-backdrop animate-in" onClick={() => setTierConfirmData(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%', background: '#e0e7ff',
                color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Confirm Subscription Plan Change
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                  Re-verify plan tier and duration before updating user record
                </p>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8,
              padding: '14px 16px', fontSize: '0.825rem', marginBottom: 16, lineHeight: 1.5
            }}>
              <div><strong>Target User:</strong> {userNames[tierConfirmData.user.id]?.displayName || tierConfirmData.user.displayName || 'Subscriber'}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {userNames[tierConfirmData.user.id]?.email || tierConfirmData.user.id}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '8px 12px', background: 'var(--bg-card-hover)', borderRadius: 6 }}>
                <span className="badge badge-blue">{tierConfirmData.user.tier}</span>
                <span>➔</span>
                <span className="badge badge-purple">{tierConfirmData.targetTier}</span>
              </div>
            </div>

            {/* Tenure Options for Pro Plan */}
            {tierConfirmData.targetTier === 'Pro Plan (Paid)' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Select Pro Subscription Duration / Tenure:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { id: 'monthly', label: '1 Month (Monthly Renewal)', desc: 'Valid for 30 days from today' },
                    { id: 'annual', label: '1 Year (Annual Renewal)', desc: 'Valid for 365 days from today' },
                    { id: 'lifetime', label: 'Lifetime Pro (100 Years)', desc: 'Valid indefinitely without expiry' },
                  ].map(opt => (
                    <label key={opt.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                      borderRadius: 6, border: `1px solid ${tierConfirmData.tenure === opt.id ? '#6366f1' : 'var(--border-color)'}`,
                      background: tierConfirmData.tenure === opt.id ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        name="proTenure"
                        checked={tierConfirmData.tenure === opt.id}
                        onChange={() => setTierConfirmData(prev => prev ? { ...prev, tenure: opt.id } : null)}
                      />
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{opt.label}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Duration Options for Pro Trial */}
            {tierConfirmData.targetTier === 'Pro Trial' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Select Pro Trial Duration:
                </label>
                <select
                  value={tierConfirmData.trialDays}
                  onChange={e => setTierConfirmData(prev => prev ? { ...prev, trialDays: e.target.value } : null)}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                    color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.85rem'
                  }}
                >
                  <option value={7}>7 Days Trial</option>
                  <option value={14}>14 Days Trial</option>
                  <option value={30}>30 Days Trial (Default)</option>
                  <option value={90}>90 Days Extended Trial</option>
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setTierConfirmData(null)}
                disabled={savingTier}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={executeTierChange}
                disabled={savingTier}
              >
                {savingTier ? (
                  <div className="loading-spinner" style={{ width: 14, height: 14 }} />
                ) : (
                  'Confirm & Update Plan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
