import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase, fetchUserProfiles } from '../lib/supabase'
import {
  Activity, RefreshCw, Search, Eye, Users, Compass,
  TrendingUp, BarChart2, Clock, Zap, Globe, ArrowRight,
  UserCheck, FileText, Share2, ShieldCheck, MousePointer,
  ArrowDownRight, ArrowDown, ArrowUp, Filter, ChevronDown
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie,
  LineChart, Line, Legend
} from 'recharts'

// ─── Custom Recharts Tooltip ────────────────────────────────────────────────
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

// ─── Funnel Step Colors ─────────────────────────────────────────────────────
const FUNNEL_STEPS = [
  { key: 'signup_completed', label: 'Sign Up', icon: UserCheck, color: '#6366f1' },
  { key: 'onboarding_completed', label: 'Onboarding', icon: ShieldCheck, color: '#8b5cf6' },
  { key: 'account_created', label: 'Account Created', icon: FileText, color: '#3b82f6' },
  { key: 'upgrade_clicked', label: 'Upgrade Intent', icon: Zap, color: '#a855f7' },
  { key: 'payment_completed', label: 'Pro Conversion', icon: TrendingUp, color: '#10b981' },
  { key: 'referral_completed', label: 'Referral Join', icon: Share2, color: '#f59e0b' },
]

const EVENT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6']

export default function AnalyticsStream() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMetadata, setSelectedMetadata] = useState(null)
  const [dateRange, setDateRange] = useState('24h') // '24h', '7d', '30d'
  const [isLive, setIsLive] = useState(false)
  const [syncDirection, setSyncDirection] = useState(null) // 'down' = fetching, 'up' = synced
  const [userNames, setUserNames] = useState({})
  const liveTimerRef = useRef(null)

  useEffect(() => {
    loadEvents()

    const channel = supabase
      .channel('public:analytics_events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'analytics_events' }, payload => {
        setEvents(prev => [payload.new, ...prev.slice(0, 999)])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // ── Silent fetch (no loading spinner — seamless data refresh) ───────
  const silentFetch = useCallback(async () => {
    try {
      setSyncDirection('up') // ↑ query sent
      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000)

      setSyncDirection('both') // ↑↓ syncing data
      if (!error && data) setEvents(data)
      setTimeout(() => setSyncDirection('up'), 600)
    } catch (_) {
      setSyncDirection('up')
    }
  }, [])

  async function loadEvents() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000)

      if (error) throw error
      setEvents(data || [])

      // Fetch user profile display names
      const profiles = await fetchUserProfiles()
      setUserNames(profiles || {})
    } catch (err) {
      console.error('Failed to load analytics events:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Live Polling Mode (random 2-5s interval) ──────────────────────
  useEffect(() => {
    if (!isLive) {
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current)
      return
    }

    function schedulePoll() {
      const delay = 2000 + Math.random() * 3000 // 2–5 seconds
      liveTimerRef.current = setTimeout(async () => {
        await silentFetch()
        schedulePoll()
      }, delay)
    }

    silentFetch() // immediate first fetch
    schedulePoll()

    return () => {
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current)
    }
  }, [isLive, silentFetch])

  // ═══════════════════════════════════════════════════════════════════════════
  //  GOOGLE ANALYTICS-GRADE METRICS COMPUTATION
  // ═══════════════════════════════════════════════════════════════════════════
  const insights = useMemo(() => {
    const now = new Date()
    const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000)
    const todayStr = now.toISOString().split('T')[0]

    // ── Time range filter ────────────────────────────────────────────────
    let rangeMs = 24 * 60 * 60 * 1000
    if (dateRange === '7d') rangeMs = 7 * 24 * 60 * 60 * 1000
    if (dateRange === '30d') rangeMs = 30 * 24 * 60 * 60 * 1000
    const rangeStart = dateRange === 'all' ? new Date(0) : new Date(now.getTime() - rangeMs)

    const rangedEvents = events.filter(e => new Date(e.created_at) >= rangeStart)

    // Helper to get persistent user/session key
    const getUserKey = (e) => e.user_id || e.metadata?.session_id || e.metadata?.visitor_id || e.metadata?.email || 'anon_visitor'

    // ── 1. KPI Scorecards ────────────────────────────────────────────────
    // Realtime active users (last 5 min)
    const realtimeUsers = new Set()
    events.forEach(e => {
      if (new Date(e.created_at) >= fiveMinsAgo) {
        realtimeUsers.add(getUserKey(e))
      }
    })
    const realtimeCount = Math.max(realtimeUsers.size, events.length > 0 ? 1 : 0)

    // DAU — distinct users today
    const todayUsers = new Set()
    rangedEvents.forEach(e => {
      if (new Date(e.created_at).toISOString().split('T')[0] === todayStr) {
        todayUsers.add(getUserKey(e))
      }
    })
    const dauCount = todayUsers.size

    // Total page views in range
    const pageViewEvents = rangedEvents.filter(e => e.event_name === 'page_viewed')
    const totalPageViews = pageViewEvents.length

    // Bounce Rate — % of distinct user sessions with only 1 page_viewed event and 0 feature actions
    const userEventCounts = {}
    rangedEvents.forEach(e => {
      const uid = getUserKey(e)
      if (!userEventCounts[uid]) userEventCounts[uid] = { pageViews: 0, totalEvents: 0 }
      userEventCounts[uid].totalEvents++
      if (e.event_name === 'page_viewed') userEventCounts[uid].pageViews++
    })
    const totalSessionUsers = Object.keys(userEventCounts).length
    const bouncedSessionUsers = Object.values(userEventCounts).filter(u => u.pageViews === 1 && u.totalEvents === 1).length
    const bounceRate = totalSessionUsers > 0 ? Math.round((bouncedSessionUsers / totalSessionUsers) * 100) : 0

    // Avg session duration (time between first & last event per user in range)
    const userTimestamps = {}
    rangedEvents.forEach(e => {
      const uid = getUserKey(e)
      const ts = new Date(e.created_at).getTime()
      if (!userTimestamps[uid]) userTimestamps[uid] = { min: ts, max: ts }
      else {
        if (ts < userTimestamps[uid].min) userTimestamps[uid].min = ts
        if (ts > userTimestamps[uid].max) userTimestamps[uid].max = ts
      }
    })
    const durations = Object.values(userTimestamps).map(t => t.max - t.min).filter(d => d > 0)
    const avgSessionMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    const avgSessionMin = Math.floor(avgSessionMs / 60000)
    const avgSessionSec = Math.floor((avgSessionMs % 60000) / 1000)

    // ── 2. Conversion Funnel ─────────────────────────────────────────────
    const funnelData = FUNNEL_STEPS.map(step => {
      const uniqueUsers = new Set()
      events.forEach(e => {
        if (e.event_name === step.key && e.user_id) uniqueUsers.add(e.user_id)
      })
      return { ...step, users: uniqueUsers.size }
    })
    const funnelMax = Math.max(...funnelData.map(f => f.users), 1)

    // ── 3. Traffic Over Time (hourly for 24h, daily for 7d/30d) ──────────
    const trafficData = []
    if (dateRange === '24h') {
      for (let i = 23; i >= 0; i--) {
        const hDate = new Date(now.getTime() - i * 60 * 60 * 1000)
        const hourLabel = hDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        const hourStart = new Date(hDate.getFullYear(), hDate.getMonth(), hDate.getDate(), hDate.getHours(), 0, 0)
        const hourEnd = new Date(hDate.getFullYear(), hDate.getMonth(), hDate.getDate(), hDate.getHours(), 59, 59)

        let pv = 0, feat = 0
        rangedEvents.forEach(e => {
          const eTime = new Date(e.created_at)
          if (eTime >= hourStart && eTime <= hourEnd) {
            if (e.event_name === 'page_viewed') pv++
            else feat++
          }
        })
        trafficData.push({ time: hourLabel, pageViews: pv, features: feat })
      }
    } else {
      const days = dateRange === '7d' ? 7 : 30
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(now.getDate() - i)
        const dStr = d.toISOString().split('T')[0]
        const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        let pv = 0, feat = 0
        rangedEvents.forEach(e => {
          if (new Date(e.created_at).toISOString().split('T')[0] === dStr) {
            if (e.event_name === 'page_viewed') pv++
            else feat++
          }
        })
        trafficData.push({ time: label, pageViews: pv, features: feat })
      }
    }

    // ── 4. Top Pages (bar chart) ─────────────────────────────────────────
    const pageCounts = {}
    pageViewEvents.forEach(e => {
      const path = String(e.metadata?.path || '/').toLowerCase()
      pageCounts[path] = (pageCounts[path] || 0) + 1
    })
    const topPages = Object.entries(pageCounts)
      .map(([name, views]) => ({ name: name.toLowerCase(), views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 8)

    // ── 5. Event Type Breakdown (donut chart) ────────────────────────────
    const eventTypeCounts = {}
    rangedEvents.forEach(e => {
      eventTypeCounts[e.event_name] = (eventTypeCounts[e.event_name] || 0) + 1
    })
    const eventBreakdown = Object.entries(eventTypeCounts)
      .map(([name, value], i) => ({
        name: name.replace(/_/g, ' '),
        value,
        color: EVENT_COLORS[i % EVENT_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)

    // ── 6. Daily Active Users Trend (7-day) ──────────────────────────────
    const dauTrend = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dStr = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
      const dayUsers = new Set()
      events.forEach(e => {
        if (new Date(e.created_at).toISOString().split('T')[0] === dStr) {
          dayUsers.add(e.user_id || `anon_${e.id?.slice(0, 6)}`)
        }
      })
      dauTrend.push({ day: label, users: dayUsers.size })
    }

    // ── 7. Top Users by Activity ─────────────────────────────────────────
    const userEmailMap = {}
    events.forEach(e => {
      if (e.user_id && !userEmailMap[e.user_id]) {
        const mail = e.metadata?.email || e.metadata?.user_email
        if (mail) userEmailMap[e.user_id] = mail
      }
    })

    const userActivityMap = {}
    rangedEvents.forEach(e => {
      const uid = e.user_id || null
      if (!uid) return
      if (!userActivityMap[uid]) {
        userActivityMap[uid] = { userId: uid, events: 0, pageViews: 0, features: 0, lastSeen: e.created_at, firstSeen: e.created_at }
      }
      userActivityMap[uid].events++
      if (e.event_name === 'page_viewed') userActivityMap[uid].pageViews++
      else userActivityMap[uid].features++
      if (new Date(e.created_at) > new Date(userActivityMap[uid].lastSeen)) {
        userActivityMap[uid].lastSeen = e.created_at
      }
      if (new Date(e.created_at) < new Date(userActivityMap[uid].firstSeen)) {
        userActivityMap[uid].firstSeen = e.created_at
      }
    })

    const topUsers = Object.values(userActivityMap)
      .sort((a, b) => b.events - a.events)
      .slice(0, 10)
      .map(u => {
        const profile = userNames[u.userId]
        const email = userEmailMap[u.userId] || (typeof profile === 'object' ? profile?.email : null) || null
        const accName = typeof profile === 'object' ? profile?.displayName : (profile || null)
        const displayName = accName || email || `User #${u.userId.slice(0, 8)}`
        return { ...u, email, displayName }
      })

    const totalUniqueUsers = Object.keys(userActivityMap).length
    const avgEventsPerUser = totalUniqueUsers > 0 ? Math.round(rangedEvents.length / totalUniqueUsers) : 0

    // New vs Returning (users with firstSeen today vs before today)
    let newUsers = 0, returningUsers = 0
    Object.values(userActivityMap).forEach(u => {
      if (new Date(u.firstSeen).toISOString().split('T')[0] === todayStr) newUsers++
      else returningUsers++
    })

    return {
      realtimeCount, dauCount, totalPageViews, bounceRate,
      avgSessionMin, avgSessionSec,
      funnelData, funnelMax,
      trafficData,
      topPages, eventBreakdown,
      dauTrend,
      topUsers, totalUniqueUsers, avgEventsPerUser,
      newUsers, returningUsers,
      totalEvents: rangedEvents.length
    }
  }, [events, dateRange])

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="animate-in">
      {/* ─── Title & Controls ─────────────────────────────────────────── */}
      <div className="page-title-row">
        <div>
          <h1 className="page-title">Analytics Intelligence</h1>
          <p className="page-desc">Behavioral insights, conversion funnels, and traffic intelligence</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Date Range Selector + Live Toggle */}
          <div className="range-selector">
            <button
              className={`range-btn ${isLive ? 'live-active' : ''}`}
              onClick={() => { setIsLive(prev => !prev); if (isLive) setSyncDirection(null) }}
              title={isLive ? 'Disable live polling' : 'Enable live polling (2-5s refresh)'}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isLive ? '#10b981' : '#94a3b8',
                boxShadow: isLive ? '0 0 8px #10b981' : 'none',
                display: 'inline-block',
                transition: 'all 0.3s ease'
              }} className={isLive ? 'animate-pulse' : ''} />
              Live
              {isLive && syncDirection && (
                <span className={`sync-arrow ${syncDirection === 'both' ? 'sync-both' : 'sync-up'}`}>
                  {syncDirection === 'both' ? (
                    <>
                      <ArrowUp size={10} strokeWidth={3} />
                      <ArrowDown size={10} strokeWidth={3} />
                    </>
                  ) : (
                    <ArrowUp size={12} strokeWidth={2.5} />
                  )}
                </span>
              )}
            </button>
            <div style={{ width: 1, height: 18, background: 'var(--border-color)', margin: '0 2px' }} />
            {['24h', '7d', '30d', 'all'].map(r => (
              <button
                key={r}
                className={`range-btn ${dateRange === r && !isLive ? 'active' : ''}`}
                onClick={() => { setDateRange(r); setIsLive(false) }}
              >
                {r === '24h' ? 'Last 24h' : r === '7d' ? 'Last 7 Days' : r === '30d' ? 'Last 30 Days' : 'All Time'}
              </button>
            ))}
          </div>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              if (!events.length) return
              const headers = ['id', 'created_at', 'event_name', 'user_id', 'metadata']
              const rows = events.map(e => [
                e.id,
                e.created_at,
                e.event_name,
                e.user_id || 'anonymous',
                JSON.stringify(e.metadata || {}).replace(/"/g, '""')
              ])
              const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n')
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `Accountize_Analytics_Export_${new Date().toISOString().split('T')[0]}.csv`
              a.click()
              URL.revokeObjectURL(url)
            }}
            disabled={!events.length}
            title="Export telemetry events to CSV"
          >
            <FileText size={14} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={loadEvents} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           SECTION 1: KPI SCORECARDS
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {/* Realtime Users */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Users Right Now</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: '#10b981',
                boxShadow: '0 0 10px #10b981', display: 'inline-block'
              }} className="animate-pulse" />
              <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>Live</span>
            </div>
          </div>
          <div className="metric-value">{insights.realtimeCount}</div>
          <div className="metric-subtext">Active in last 5 minutes</div>
        </div>

        {/* DAU */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Active Users Today</span>
            <div className="metric-icon badge-indigo"><Users size={18} /></div>
          </div>
          <div className="metric-value">{insights.dauCount}</div>
          <div className="metric-subtext">
            <span style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <TrendingUp size={11} /> DAU metric
            </span>
          </div>
        </div>

        {/* Total Page Views */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Page Views</span>
            <div className="metric-icon badge-blue"><Globe size={18} /></div>
          </div>
          <div className="metric-value">{insights.totalPageViews.toLocaleString()}</div>
          <div className="metric-subtext">{insights.totalEvents.toLocaleString()} total events in range</div>
        </div>

        {/* Bounce Rate */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Bounce Rate</span>
            <div className="metric-icon badge-amber"><ArrowDownRight size={18} /></div>
          </div>
          <div className="metric-value">{insights.bounceRate}%</div>
          <div className="metric-subtext" style={{ color: insights.bounceRate > 60 ? 'var(--red)' : 'var(--green)' }}>
            {insights.bounceRate > 60 ? 'High — needs attention' : insights.bounceRate > 30 ? 'Moderate' : 'Excellent'}
          </div>
        </div>

        {/* Avg Session Duration */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Avg. Session Duration</span>
            <div className="metric-icon badge-purple"><Clock size={18} /></div>
          </div>
          <div className="metric-value">
            {insights.avgSessionMin > 0 ? `${insights.avgSessionMin}m ${insights.avgSessionSec}s` : `${insights.avgSessionSec}s`}
          </div>
          <div className="metric-subtext">Time between first & last event</div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           SECTION 2: CONVERSION FUNNEL
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="table-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Conversion Funnel</h3>
            <p className="metric-subtext" style={{ margin: 0 }}>User journey from signup to first shared ledger</p>
          </div>
          <span className="badge badge-indigo">All Time</span>
        </div>

        <div className="funnel-container">
          {insights.funnelData.map((step, idx) => {
            const Icon = step.icon
            const widthPct = insights.funnelMax > 0 ? Math.max((step.users / insights.funnelMax) * 100, 8) : 8
            const dropoff = idx > 0 && insights.funnelData[idx - 1].users > 0
              ? Math.round(((insights.funnelData[idx - 1].users - step.users) / insights.funnelData[idx - 1].users) * 100)
              : null

            return (
              <div key={step.key} className="funnel-step">
                <div className="funnel-label-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: step.color + '18', display: 'flex',
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Icon size={15} color={step.color} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{step.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {dropoff !== null && dropoff > 0 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--red)', fontWeight: 600 }}>
                        −{dropoff}% drop
                      </span>
                    )}
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: step.color }}>
                      {step.users}
                    </span>
                  </div>
                </div>
                <div className="funnel-bar-bg">
                  <div
                    className="funnel-bar-fill"
                    style={{ width: `${widthPct}%`, background: `linear-gradient(90deg, ${step.color}, ${step.color}88)` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           SECTION 3: TRAFFIC OVER TIME
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="table-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Traffic Overview</h3>
            <p className="metric-subtext" style={{ margin: 0 }}>Page views vs feature actions over time</p>
          </div>
          <span className="badge badge-indigo">{dateRange === '24h' ? 'Hourly' : 'Daily'}</span>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={insights.trafficData}>
              <defs>
                <linearGradient id="gPv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gFt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<SlateTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.8rem', paddingTop: 8 }} />
              <Area type="monotone" dataKey="pageViews" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#gPv)" name="Page Views" />
              <Area type="monotone" dataKey="features" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#gFt)" name="Feature Actions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           SECTION 4: TOP PAGES + EVENT BREAKDOWN (2-column)
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="insights-grid">
        {/* Top Pages Bar Chart */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Top Pages</h3>
              <p className="metric-subtext" style={{ margin: 0 }}>Most visited routes</p>
            </div>
            <span className="badge badge-amber"><Compass size={12} /> Routes</span>
          </div>
          <div style={{ width: '100%', height: 240 }}>
            {insights.topPages.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No page view data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.topPages} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} />
                  <YAxis type="category" dataKey="name" stroke="#475569" fontSize={10} width={90} tickLine={false} />
                  <Tooltip content={<SlateTooltip />} />
                  <Bar dataKey="views" radius={[0, 6, 6, 0]} name="Views">
                    {insights.topPages.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#6366f1' : i === 1 ? '#818cf8' : '#c7d2fe'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Event Type Breakdown Donut */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Event Breakdown</h3>
              <p className="metric-subtext" style={{ margin: 0 }}>Distribution of all event types</p>
            </div>
            <span className="badge badge-purple"><BarChart2 size={12} /> Types</span>
          </div>
          <div className="donut-card-body">
            <div style={{ width: 160, height: 160, flexShrink: 0 }}>
              {insights.eventBreakdown.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={insights.eventBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={42} outerRadius={70}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={2}
                    >
                      {insights.eventBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<SlateTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="donut-legend">
              {insights.eventBreakdown.map((entry, i) => (
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

      {/* ═══════════════════════════════════════════════════════════════════
           SECTION 5: DAU TREND + USER COMPOSITION (2-column)
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="insights-grid" style={{ marginTop: 24 }}>
        {/* DAU Trend Line Chart */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Daily Active Users</h3>
              <p className="metric-subtext" style={{ margin: 0 }}>Unique users per day (7-day trend)</p>
            </div>
            <span className="badge badge-green"><TrendingUp size={12} /> DAU</span>
          </div>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={insights.dauTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<SlateTooltip />} />
                <Line
                  type="monotone" dataKey="users" stroke="#6366f1" strokeWidth={2.5}
                  dot={{ fill: '#6366f1', strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                  name="Active Users"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Composition Summary */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>User Composition</h3>
            <p className="metric-subtext" style={{ margin: 0 }}>Audience & engagement snapshot</p>
          </div>
          <div className="composition-grid">
            <div className="composition-stat">
              <div className="composition-stat-value">{insights.totalUniqueUsers}</div>
              <div className="composition-stat-label">Total Unique Users</div>
            </div>
            <div className="composition-stat">
              <div className="composition-stat-value">{insights.avgEventsPerUser}</div>
              <div className="composition-stat-label">Avg. Events / User</div>
            </div>
            <div className="composition-stat">
              <div className="composition-stat-value" style={{ color: 'var(--green)' }}>{insights.newUsers}</div>
              <div className="composition-stat-label">New Users (Today)</div>
            </div>
            <div className="composition-stat">
              <div className="composition-stat-value" style={{ color: 'var(--indigo)' }}>{insights.returningUsers}</div>
              <div className="composition-stat-label">Returning Users</div>
            </div>
          </div>
          {/* New vs Returning mini bar */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>New vs Returning Split</div>
            <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--bg-primary)', display: 'flex' }}>
              <div style={{
                width: `${insights.totalUniqueUsers > 0 ? (insights.newUsers / insights.totalUniqueUsers) * 100 : 50}%`,
                background: 'var(--green)', transition: 'width 0.5s ease'
              }} />
              <div style={{
                flex: 1, background: 'var(--indigo)', transition: 'width 0.5s ease'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--green)', fontWeight: 600 }}>
                New {insights.totalUniqueUsers > 0 ? Math.round((insights.newUsers / insights.totalUniqueUsers) * 100) : 0}%
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--indigo)', fontWeight: 600 }}>
                Returning {insights.totalUniqueUsers > 0 ? Math.round((insights.returningUsers / insights.totalUniqueUsers) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           SECTION 6: TOP USERS BY ACTIVITY
           ═══════════════════════════════════════════════════════════════════ */}
      <div className="table-card" style={{ marginTop: 24 }}>
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={16} color="var(--accent-primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Top Users by Engagement</span>
            <span className="badge badge-indigo">{insights.topUsers.length} users</span>
          </div>
        </div>

        {insights.topUsers.length === 0 ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
            No user activity data in selected range.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>User / Display Name</th>
                  <th>Total Events</th>
                  <th>Page Views</th>
                  <th>Feature Actions</th>
                  <th>Last Active</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {insights.topUsers.map((u, i) => (
                  <tr key={u.userId}>
                    <td>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: i < 3 ? 'var(--accent-gradient)' : 'var(--bg-primary)',
                        color: i < 3 ? '#fff' : 'var(--text-muted)',
                        fontSize: '0.7rem', fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {i + 1}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.displayName}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                          ID: {u.userId.slice(0, 8)}...
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.events}</span>
                    </td>
                    <td><span className="badge badge-blue">{u.pageViews}</span></td>
                    <td><span className="badge badge-purple">{u.features}</span></td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(u.lastSeen).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedMetadata({
                          userId: u.userId,
                          totalEvents: u.events,
                          pageViews: u.pageViews,
                          featureActions: u.features,
                          firstSeen: u.firstSeen,
                          lastSeen: u.lastSeen
                        })}
                      >
                        <Eye size={12} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Payload Modal ────────────────────────────────────────────── */}
      {selectedMetadata && (
        <div className="modal-backdrop animate-in" onClick={() => setSelectedMetadata(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-gradient)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem'
                }}>
                  {(userNames[selectedMetadata.userId] || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    {userNames[selectedMetadata.userId] || `User #${selectedMetadata.userId.slice(0, 8)}`}
                  </h3>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {selectedMetadata.userId}
                  </div>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedMetadata(null)}>✕ Close</button>
            </div>

            {/* Quick Metrics Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedMetadata.totalEvents}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Events</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#3b82f6' }}>{selectedMetadata.pageViews}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Page Views</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#8b5cf6' }}>{selectedMetadata.featureActions}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Features</div>
              </div>
            </div>

            {/* User Journey Event Timeline */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                Recent Activity Journey
              </div>
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                maxHeight: 240,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}>
                {events.filter(e => e.user_id === selectedMetadata.userId).slice(0, 12).map((evt, idx) => (
                  <div key={evt.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dashed var(--border-color)', paddingBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${evt.event_name === 'page_viewed' ? 'badge-blue' : evt.event_name.includes('error') ? 'badge-red' : 'badge-indigo'}`} style={{ fontSize: '0.65rem' }}>
                        {evt.event_name.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {evt.metadata?.title || evt.metadata?.path || evt.metadata?.action || JSON.stringify(evt.metadata || {})}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {new Date(evt.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
