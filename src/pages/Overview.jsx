import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, fetchUserProfiles } from '../lib/supabase'
import {
  Users, DollarSign, Activity, Share2, ShieldAlert, AlertTriangle,
  TrendingUp, RefreshCw, Clock, ArrowRight, MessageSquare, ShieldCheck,
  CheckCircle, Zap, Eye, Compass
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
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

const MODULE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function Overview() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    totalTransactions: 0,
    totalSharedLinks: 0,
    totalErrors: 0,
    openTickets: 0,
    mrr: 0,
    totalVolume: 0
  })
  const [chartData, setChartData] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [userNames, setUserNames] = useState({})
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('7d')

  useEffect(() => {
    loadOverviewData()
  }, [dateRange])

  async function loadOverviewData() {
    try {
      setLoading(true)

      const profiles = await fetchUserProfiles()
      const map = {}
      Object.entries(profiles).forEach(([uid, p]) => {
        map[uid] = p.displayName
      })
      setUserNames(map)

      // Database counts
      const { count: txCount, data: txData } = await supabase.from('transactions').select('amount, created_at')
      const { count: linksCount } = await supabase.from('shared_links').select('*', { count: 'exact', head: true })
      const { count: errCount } = await supabase.from('error_logs').select('*', { count: 'exact', head: true }).or('resolved.eq.false,resolved.is.null')
      const { count: ticketCount } = await supabase.from('error_logs').select('*', { count: 'exact', head: true }).ilike('error_message', '%[Support Ticket]%')

      // Total transaction sum volume
      const totalVolume = (txData || []).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0)

      // Real user count from user_profiles table & accounts table
      const profileCount = Object.keys(profiles).length
      const { data: accountsUsers } = await supabase.from('accounts').select('user_id')
      const uniqueUsers = new Set((accountsUsers || []).map(a => a.user_id).filter(Boolean))
      const totalUsers = Math.max(profileCount, uniqueUsers.size, 1)

      const calculatedMRR = totalUsers * 499

      setMetrics({
        totalUsers: totalUsers,
        totalTransactions: txCount || 0,
        totalSharedLinks: linksCount || 0,
        totalErrors: errCount || 0,
        openTickets: ticketCount || 0,
        mrr: calculatedMRR,
        totalVolume: totalVolume
      })

      // Fetch recent combined activity stream (last 8 events/errors/txs)
      const { data: recentEvents } = await supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      const { data: recentErrors } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      // Build unified recent activity feed
      const combinedFeed = []
      if (recentEvents) {
        recentEvents.forEach(e => {
          combinedFeed.push({
            id: `evt_${e.id}`,
            type: 'event',
            title: e.event_name.replace(/_/g, ' '),
            subtitle: String(e.metadata?.path || e.metadata?.action || 'User activity').toLowerCase(),
            userId: e.user_id,
            timestamp: e.created_at,
            badgeClass: 'badge-indigo',
            badgeText: 'Analytics'
          })
        })
      }

      if (recentErrors) {
        recentErrors.forEach(err => {
          const isTicket = err.error_message?.includes('[Support Ticket]')
          combinedFeed.push({
            id: `err_${err.id}`,
            type: isTicket ? 'ticket' : 'error',
            title: isTicket ? err.error_message.replace('[Support Ticket]', '').trim() : err.error_message,
            subtitle: String(err.url || 'Runtime exception').toLowerCase(),
            userId: err.user_id,
            timestamp: err.created_at,
            badgeClass: isTicket ? 'badge-amber' : 'badge-rose',
            badgeText: isTicket ? 'Ticket' : 'Error'
          })
        })
      }

      combinedFeed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      setRecentLogs(combinedFeed.slice(0, 7))

      // Build trend data based on dateRange
      const now = new Date()
      const days = dateRange === '24h' ? 1 : dateRange === '7d' ? 7 : 30
      const trendMap = new Map()

      if (dateRange === '24h') {
        for (let i = 23; i >= 0; i--) {
          const hDate = new Date(now.getTime() - i * 60 * 60 * 1000)
          const label = hDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
          const hKey = hDate.getHours()
          trendMap.set(i, { name: label, hour: hKey, events: 0, txs: 0 })
        }
      } else {
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now)
          d.setDate(now.getDate() - i)
          const dStr = d.toISOString().split('T')[0]
          const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
          trendMap.set(dStr, { name: label, events: 0, txs: 0 })
        }
      }

      // Fetch analytics events & transactions for range
      const { data: rangeEvents } = await supabase.from('analytics_events').select('created_at').order('created_at', { ascending: false }).limit(500)
      const { data: rangeTxs } = await supabase.from('transactions').select('created_at').order('created_at', { ascending: false }).limit(500)

      if (dateRange === '24h') {
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        ;(rangeEvents || []).forEach(e => {
          const eDate = new Date(e.created_at)
          if (eDate >= oneDayAgo) {
            const hoursAgo = Math.floor((now.getTime() - eDate.getTime()) / (60 * 60 * 1000))
            if (trendMap.has(hoursAgo)) trendMap.get(hoursAgo).events++
          }
        })
        ;(rangeTxs || []).forEach(t => {
          const tDate = new Date(t.created_at)
          if (tDate >= oneDayAgo) {
            const hoursAgo = Math.floor((now.getTime() - tDate.getTime()) / (60 * 60 * 1000))
            if (trendMap.has(hoursAgo)) trendMap.get(hoursAgo).txs++
          }
        })
      } else {
        ;(rangeEvents || []).forEach(e => {
          const dStr = new Date(e.created_at).toISOString().split('T')[0]
          if (trendMap.has(dStr)) trendMap.get(dStr).events++
        })
        ;(rangeTxs || []).forEach(t => {
          const dStr = new Date(t.created_at).toISOString().split('T')[0]
          if (trendMap.has(dStr)) trendMap.get(dStr).txs++
        })
      }

      setChartData(Array.from(trendMap.values()))
    } catch (err) {
      console.error('Failed to load executive overview metrics:', err)
    } finally {
      setLoading(false)
    }
  }

  // Distribution chart payload
  const distributionData = useMemo(() => [
    { name: 'Analytics Events', value: chartData.reduce((acc, c) => acc + c.events, 0) || 120, color: MODULE_COLORS[0] },
    { name: 'Transactions', value: metrics.totalTransactions || 45, color: MODULE_COLORS[1] },
    { name: 'Shared Ledgers', value: metrics.totalSharedLinks || 12, color: MODULE_COLORS[2] },
    { name: 'Runtime Errors', value: metrics.totalErrors || 3, color: MODULE_COLORS[3] },
    { name: 'Support Tickets', value: metrics.openTickets || 5, color: MODULE_COLORS[4] },
  ], [chartData, metrics])

  return (
    <div className="animate-in">
      {/* ── Title & Range Controls ───────────────────────────────────────── */}
      <div className="page-title-row">
        <div>
          <h1 className="page-title">Executive Command Overview</h1>
          <p className="page-desc">Real-time system health, financial metrics, and engagement intelligence</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="range-selector">
            {['24h', '7d', '30d'].map(r => (
              <button
                key={r}
                className={`range-btn ${dateRange === r ? 'active' : ''}`}
                onClick={() => setDateRange(r)}
              >
                {r === '24h' ? '24 Hours' : r === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={loadOverviewData} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* ── SECTION 1: EXECUTIVE KPI SCORECARDS ─────────────────────────── */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {/* MRR */}
        <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/users')}>
          <div className="metric-header">
            <span className="metric-label">Est. MRR Revenue</span>
            <div className="metric-icon badge-green"><DollarSign size={18} /></div>
          </div>
          <div className="metric-value">₹{metrics.mrr.toLocaleString('en-IN')}</div>
          <div className="metric-subtext" style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={12} /> ₹499/mo per user estimate
          </div>
        </div>

        {/* Total Users */}
        <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/users')}>
          <div className="metric-header">
            <span className="metric-label">Total Users</span>
            <div className="metric-icon badge-blue"><Users size={18} /></div>
          </div>
          <div className="metric-value">{metrics.totalUsers}</div>
          <div className="metric-subtext">Active registered accounts</div>
        </div>

        {/* Transactions */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Tx Volume Processed</span>
            <div className="metric-icon badge-purple"><Activity size={18} /></div>
          </div>
          <div className="metric-value">{metrics.totalTransactions}</div>
          <div className="metric-subtext">₹{metrics.totalVolume.toLocaleString('en-IN')} gross entries</div>
        </div>

        {/* Shared Ledgers */}
        <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/governance')}>
          <div className="metric-header">
            <span className="metric-label">Shared Ledgers</span>
            <div className="metric-icon badge-amber"><Share2 size={18} /></div>
          </div>
          <div className="metric-value">{metrics.totalSharedLinks}</div>
          <div className="metric-subtext">Public collaborative tokens</div>
        </div>

        {/* System Health / Errors */}
        <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/errors')}>
          <div className="metric-header">
            <span className="metric-label">Unresolved Errors</span>
            <div className="metric-icon badge-rose"><AlertTriangle size={18} /></div>
          </div>
          <div className="metric-value" style={{ color: metrics.totalErrors > 0 ? 'var(--red)' : 'var(--green)' }}>
            {metrics.totalErrors}
          </div>
          <div className="metric-subtext" style={{ color: metrics.totalErrors > 0 ? 'var(--red)' : 'var(--green)' }}>
            {metrics.totalErrors > 0 ? 'Action required' : 'All systems normal'}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: PLATFORM ENGAGEMENT TREND ────────────────────────── */}
      <div className="table-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Platform Velocity &amp; Transaction Trend</h3>
            <p className="metric-subtext" style={{ margin: 0 }}>Analytics events volume vs transactions created</p>
          </div>
          <span className="badge badge-indigo">{dateRange === '24h' ? 'Hourly View' : dateRange === '7d' ? '7-Day View' : '30-Day View'}</span>
        </div>

        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gEvts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gTxs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<SlateTooltip />} />
              <Area type="monotone" dataKey="events" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#gEvts)" name="Analytics Events" />
              <Area type="monotone" dataKey="txs" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#gTxs)" name="Transactions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── SECTION 3: SYSTEM ACTIVITY COMPOSITION ────────────────────────── */}
      <div className="table-card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>System Activity Composition</h3>
            <p className="metric-subtext" style={{ margin: 0 }}>Distribution across platform modules</p>
          </div>
          <span className="badge badge-purple"><Compass size={12} /> Modules</span>
        </div>

        <div className="donut-card-body">
          <div style={{ width: 160, height: 160, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%" cy="50%"
                  innerRadius={42} outerRadius={70}
                  dataKey="value"
                  stroke="none"
                  paddingAngle={2}
                >
                  {distributionData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<SlateTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="donut-legend">
            {distributionData.map((entry, i) => (
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
  )
}
