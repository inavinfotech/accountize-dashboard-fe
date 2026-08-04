import { useState, useEffect, useMemo } from 'react'
import { supabase, fetchUserProfiles } from '../lib/supabase'
import LoadingScreen from '../components/LoadingScreen'
import {
  AlertTriangle, CheckCircle, RefreshCw, Search, ShieldAlert,
  Filter, Eye, Clock, TrendingUp, BarChart2, Activity, User, Globe
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts'

// Custom Slate Tooltip for Recharts
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

const DONUT_COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#6366f1', '#ec4899']

export default function ErrorInspector() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'unresolved', 'resolved'
  const [selectedStack, setSelectedStack] = useState(null)
  const [userNames, setUserNames] = useState({})
  const [dateRange, setDateRange] = useState('7d') // '7d' or '30d'

  useEffect(() => {
    loadErrorLogs()

    const channel = supabase
      .channel('public:error_logs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'error_logs' }, payload => {
        if (payload.eventType === 'INSERT') {
          setLogs(prev => [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setLogs(prev => prev.map(item => item.id === payload.new.id ? payload.new : item))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadErrorLogs() {
    try {
      setLoading(true)
      setFetchError(null)
      const { data, error } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (error) {
        console.error('Supabase error_logs query error:', error)
        setFetchError(error.message)
      } else {
        setLogs(data || [])
      }

      const profiles = await fetchUserProfiles()
      const map = {}
      Object.entries(profiles).forEach(([uid, p]) => {
        map[uid] = p.displayName
      })
      setUserNames(map)
    } catch (err) {
      console.error('Failed to load error logs:', err)
      setFetchError(err.message || 'Failed to query database')
    } finally {
      setLoading(false)
    }
  }

  const toggleResolveStatus = async (logId, currentResolved) => {
    try {
      const { data, error } = await supabase
        .from('error_logs')
        .update({ resolved: !currentResolved })
        .eq('id', logId)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        alert('Supabase RLS Policy is blocking UPDATE on public.error_logs.\n\nPlease run this SQL in Supabase SQL Editor:\nCREATE POLICY "Allow update for error_logs" ON public.error_logs FOR UPDATE USING (true);')
        setFetchError('RLS blocking UPDATE on public.error_logs')
        return
      }

      setLogs(prev => prev.map(item => item.id === logId ? { ...item, resolved: !currentResolved } : item))
    } catch (err) {
      console.error('Failed to update resolve status:', err)
      alert(`Failed to update status: ${err.message}`)
    }
  }

  // ── Analytics Computation ───────────────────────────────────────────
  const insights = useMemo(() => {
    const totalLogs = logs.length
    const unresolvedCount = logs.filter(l => !l.resolved).length
    const resolvedCount = totalLogs - unresolvedCount
    const resolveRate = totalLogs > 0 ? Math.round((resolvedCount / totalLogs) * 100) : 100

    // Date filtering
    const now = new Date()
    const days = dateRange === '7d' ? 7 : 30
    const rangeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const rangedLogs = logs.filter(l => new Date(l.created_at) >= rangeStart)
    const avgPerDay = (rangedLogs.length / days).toFixed(1)

    // Error Trend Over Time
    const trendData = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dStr = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      let unres = 0, res = 0
      logs.forEach(l => {
        if (new Date(l.created_at).toISOString().split('T')[0] === dStr) {
          if (l.resolved) res++
          else unres++
        }
      })
      trendData.push({ date: label, Unresolved: unres, Resolved: res })
    }

    // Top Error Messages (Bar chart)
    const msgCounts = {}
    logs.forEach(l => {
      const msg = l.error_message?.trim() || 'Unknown Error'
      const shortMsg = msg.length > 35 ? msg.substring(0, 35) + '...' : msg
      msgCounts[shortMsg] = (msgCounts[shortMsg] || 0) + 1
    })
    const topErrors = Object.entries(msgCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // Errors by Page / URL (Pie chart)
    const urlCounts = {}
    logs.forEach(l => {
      const u = String(l.url || '/').toLowerCase()
      urlCounts[u] = (urlCounts[u] || 0) + 1
    })
    const errorUrls = Object.entries(urlCounts)
      .map(([name, value], i) => ({
        name: name.toLowerCase(),
        value,
        color: DONUT_COLORS[i % DONUT_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)

    // Top Affected Users
    const userErrorMap = {}
    logs.forEach(l => {
      const uid = l.user_id || 'anonymous'
      if (!userErrorMap[uid]) {
        userErrorMap[uid] = { userId: uid, total: 0, unresolved: 0, lastError: l.created_at }
      }
      userErrorMap[uid].total++
      if (!l.resolved) userErrorMap[uid].unresolved++
      if (new Date(l.created_at) > new Date(userErrorMap[uid].lastError)) {
        userErrorMap[uid].lastError = l.created_at
      }
    })

    const topAffectedUsers = Object.values(userErrorMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map(u => ({
        ...u,
        displayName: u.userId === 'anonymous' ? 'Anonymous Visitor' : (userNames[u.userId] || `User #${u.userId.slice(0, 8)}`)
      }))

    return {
      totalLogs, unresolvedCount, resolvedCount, resolveRate, avgPerDay,
      trendData, topErrors, errorUrls, topAffectedUsers
    }
  }, [logs, dateRange, userNames])

  const filteredLogs = logs.filter(item => {
    const msg = String(item.error_message || '').toLowerCase()
    const url = String(item.url || '').toLowerCase()
    const query = searchQuery.toLowerCase().trim()

    const matchesSearch = !query || msg.includes(query) || url.includes(query)
    if (!matchesSearch) return false

    if (filterStatus === 'unresolved') return !item.resolved
    if (filterStatus === 'resolved') return item.resolved
    return true
  })

  return (
    <div className="animate-in">
      {/* ── Title & Refresh ──────────────────────────────────────────────── */}
      <div className="page-title-row">
        <div>
          <h1 className="page-title">Runtime Error Log Inspector</h1>
          <p className="page-desc">Automatic client runtime JS errors, unhandled rejections &amp; diagnostics</p>
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
          <button className="btn btn-secondary" onClick={loadErrorLogs} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Logs
          </button>
        </div>
      </div>

      {/* ── SECTION 1: KPI SCORECARDS ────────────────────────────────────── */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Error Logs</span>
            <div className="metric-icon badge-rose"><ShieldAlert size={18} /></div>
          </div>
          <div className="metric-value">{insights.totalLogs}</div>
          <div className="metric-subtext">All time recorded exceptions</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Unresolved Errors</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {insights.unresolvedCount > 0 && (
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
                  boxShadow: '0 0 10px #ef4444', display: 'inline-block'
                }} className="animate-pulse" />
              )}
              <div className="metric-icon badge-amber"><AlertTriangle size={18} /></div>
            </div>
          </div>
          <div className="metric-value" style={{ color: insights.unresolvedCount > 0 ? 'var(--red)' : 'var(--green)' }}>
            {insights.unresolvedCount}
          </div>
          <div className="metric-subtext">Requires admin attention</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Resolution Rate</span>
            <div className="metric-icon badge-green"><CheckCircle size={18} /></div>
          </div>
          <div className="metric-value">{insights.resolveRate}%</div>
          <div className="metric-subtext" style={{ color: insights.resolveRate >= 80 ? 'var(--green)' : 'var(--amber)' }}>
            {insights.resolvedCount} resolved logs
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Avg. Errors / Day</span>
            <div className="metric-icon badge-purple"><Activity size={18} /></div>
          </div>
          <div className="metric-value">{insights.avgPerDay}</div>
          <div className="metric-subtext">Based on {dateRange === '7d' ? 'last 7 days' : 'last 30 days'}</div>
        </div>
      </div>

      {/* ── SECTION 2: ERROR TREND CHART ─────────────────────────────────── */}
      <div className="table-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Error Frequency Trend</h3>
            <p className="metric-subtext" style={{ margin: 0 }}>Unresolved vs resolved error occurrences over time</p>
          </div>
          <span className="badge badge-rose">{dateRange === '7d' ? '7-Day Overview' : '30-Day Overview'}</span>
        </div>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={insights.trendData}>
              <defs>
                <linearGradient id="errUnres" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="errRes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<SlateTooltip />} />
              <Area type="monotone" dataKey="Unresolved" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#errUnres)" name="Unresolved Errors" />
              <Area type="monotone" dataKey="Resolved" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#errRes)" name="Resolved Errors" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── SECTION 3: TOP ERRORS & ERRORS BY PAGE (2-Column Grid) ──────── */}
      <div className="insights-grid" style={{ marginBottom: 24 }}>
        {/* Top Error Messages Bar Chart */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Top Exception Types</h3>
              <p className="metric-subtext" style={{ margin: 0 }}>Most common error messages</p>
            </div>
            <span className="badge badge-amber"><BarChart2 size={12} /> Top {insights.topErrors.length}</span>
          </div>
          <div style={{ width: '100%', height: 230 }}>
            {insights.topErrors.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No error records found
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.topErrors} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#475569" fontSize={10} width={120} tickLine={false} />
                  <Tooltip content={<SlateTooltip />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Occurrences">
                    {insights.topErrors.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Errors by Page Donut Chart */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Errors by URL / Page</h3>
              <p className="metric-subtext" style={{ margin: 0 }}>Routes generating exceptions</p>
            </div>
            <span className="badge badge-purple"><Globe size={12} /> Routes</span>
          </div>
          <div className="donut-card-body">
            <div style={{ width: 150, height: 150, flexShrink: 0 }}>
              {insights.errorUrls.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={insights.errorUrls}
                      cx="50%" cy="50%"
                      innerRadius={40} outerRadius={66}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={2}
                    >
                      {insights.errorUrls.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<SlateTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="donut-legend">
              {insights.errorUrls.map((entry, i) => (
                <div key={i} className="donut-legend-item">
                  <span className="donut-legend-dot" style={{ background: entry.color }} />
                  <span className="donut-legend-label" title={entry.name}>{entry.name}</span>
                  <span className="donut-legend-value">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: MAIN ERROR LOG TABLE ─────────────────────────────── */}
      <div className="table-card">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <AlertTriangle size={18} color="var(--rose)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Error Logs ({filteredLogs.length})
            </span>
            {insights.unresolvedCount > 0 && (
              <span className="badge badge-rose">{insights.unresolvedCount} Unresolved</span>
            )}

            {/* Filter Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <button
                className={`btn btn-sm ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none', padding: '3px 10px' }}
                onClick={() => setFilterStatus('all')}
              >
                All ({logs.length})
              </button>
              <button
                className={`btn btn-sm ${filterStatus === 'unresolved' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none', padding: '3px 10px' }}
                onClick={() => setFilterStatus('unresolved')}
              >
                Unresolved ({insights.unresolvedCount})
              </button>
              <button
                className={`btn btn-sm ${filterStatus === 'resolved' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none', padding: '3px 10px' }}
                onClick={() => setFilterStatus('resolved')}
              >
                Resolved ({insights.resolvedCount})
              </button>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: 34 }}
              placeholder="Search message or URL..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {fetchError ? (
          <div style={{ padding: '20px 24px', background: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#dc2626' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={16} /> Supabase RLS Policy Issue ({fetchError})
            </div>
            <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 8 }}>
              Row Level Security (RLS) on <code>public.error_logs</code> is restricting SELECT or UPDATE permission. Run these queries in your <strong>Supabase SQL Editor</strong>:
            </div>
            <pre style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 8, fontSize: '0.78rem', color: '#0f172a', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
              {`CREATE POLICY "Allow select for error_logs" ON public.error_logs FOR SELECT USING (true);\nCREATE POLICY "Allow update for error_logs" ON public.error_logs FOR UPDATE USING (true);`}
            </pre>
          </div>
        ) : loading ? (
          <LoadingScreen fullScreen={false} label="Loading Runtime Error Logs..." sublabel="Fetching exception stack traces & client errors" />
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--green)' }}>
            ✓ Zero error logs found for this filter! All systems running smoothly.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Error Message</th>
                  <th>Page / URL</th>
                  <th>User Identity</th>
                  <th>Timestamp</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(item => {
                  const displayName = userNames[item.user_id] || (item.user_id ? `User #${item.user_id.slice(0, 8)}` : 'Anonymous Visitor')
                  return (
                    <tr key={item.id}>
                      <td>
                        {item.resolved ? (
                          <span className="badge badge-green"><CheckCircle size={12} /> Resolved</span>
                        ) : (
                          <span className="badge badge-rose"><AlertTriangle size={12} /> Unresolved</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.error_message}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {String(item.url || '/').toLowerCase()}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {displayName}
                          </span>
                          {item.user_id && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                              ID: {item.user_id.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedStack(item)}>
                            <Eye size={12} /> Inspect
                          </button>
                          {!item.resolved && (
                            <button className="btn btn-primary btn-sm" onClick={() => toggleResolveStatus(item.id, item.resolved)}>
                              Resolve
                            </button>
                          )}
                          {item.resolved && (
                            <button className="btn btn-secondary btn-sm" onClick={() => toggleResolveStatus(item.id, item.resolved)}>
                              Reopen
                            </button>
                          )}
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

      {/* ── Stack Trace Inspector Modal ──────────────────────────────────── */}
      {selectedStack && (
        <div className="modal-backdrop animate-in" onClick={() => setSelectedStack(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 'min(760px, 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--rose)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={18} /> Error Trace Inspector
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedStack(null)}>✕ Close</button>
            </div>

            {/* Quick Metadata Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {userNames[selectedStack.user_id] || (selectedStack.user_id ? `User #${selectedStack.user_id.slice(0, 8)}` : 'Anonymous')}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>User Identity</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(selectedStack.url || '/').toLowerCase()}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Page Route</div>
              </div>
              <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: selectedStack.resolved ? 'var(--green)' : 'var(--red)' }}>
                  {selectedStack.resolved ? 'Resolved' : 'Unresolved'}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 4 }}>
                {selectedStack.error_message}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Recorded at: {new Date(selectedStack.created_at).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium' })}
              </div>
            </div>

            <pre style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              padding: 16,
              borderRadius: 'var(--radius-md)',
              fontSize: '0.78rem',
              color: '#ef4444',
              overflowX: 'auto',
              maxHeight: 320,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {selectedStack.stack_trace || 'No stack trace details recorded for this exception.'}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
