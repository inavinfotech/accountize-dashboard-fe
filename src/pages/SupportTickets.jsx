import { useState, useEffect, useMemo } from 'react'
import { supabase, fetchUserProfiles } from '../lib/supabase'
import LoadingScreen from '../components/LoadingScreen'
import {
  MessageSquare, CheckCircle, RefreshCw, Search, Send, Clock,
  AlertCircle, TrendingUp, BarChart2, Eye, User, ShieldAlert
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

const TICKET_STATUS_COLORS = ['#f59e0b', '#10b981']

function detectPriority(subject = '', body = '') {
  const text = (subject + ' ' + body).toLowerCase()
  if (text.includes('urgent') || text.includes('critical') || text.includes('crash') || text.includes('error')) {
    return { label: 'High Priority', badgeClass: 'badge-rose' }
  }
  if (text.includes('bug') || text.includes('issue') || text.includes('failed')) {
    return { label: 'Medium', badgeClass: 'badge-amber' }
  }
  return { label: 'Normal', badgeClass: 'badge-blue' }
}

export default function SupportTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'open', 'resolved'
  const [activeTicket, setActiveTicket] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [userNames, setUserNames] = useState({})
  const [dateRange, setDateRange] = useState('30d')

  useEffect(() => {
    loadTickets()
  }, [])

  async function loadTickets() {
    try {
      setLoading(true)
      const profiles = await fetchUserProfiles()
      const map = {}
      Object.entries(profiles).forEach(([uid, p]) => {
        map[uid] = p
      })
      setUserNames(map)

      // Support tickets are stored in error_logs with prefix '[Support Ticket]'
      const { data, error } = await supabase
        .from('error_logs')
        .select('*')
        .ilike('error_message', '%[Support Ticket]%')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTickets(data || [])
    } catch (err) {
      console.error('Failed to load support tickets:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleTicketStatus = async (ticketId, currentResolved) => {
    try {
      const { data, error } = await supabase
        .from('error_logs')
        .update({ resolved: !currentResolved })
        .eq('id', ticketId)
        .select()

      if (error) throw error

      if (!data || data.length === 0) {
        alert('Supabase RLS Policy is blocking UPDATE on public.error_logs.\n\nPlease run this SQL in Supabase SQL Editor:\nCREATE POLICY "Allow update for error_logs" ON public.error_logs FOR UPDATE USING (true);')
        return
      }

      setTickets(prev => prev.map(item => item.id === ticketId ? { ...item, resolved: !currentResolved } : item))
      if (activeTicket?.id === ticketId) {
        setActiveTicket(prev => prev ? { ...prev, resolved: !currentResolved } : null)
      }
    } catch (err) {
      console.error('Failed to update ticket status:', err)
      alert(`Failed to update status: ${err.message}`)
    }
  }

  // ── Analytics Computation ───────────────────────────────────────────
  const insights = useMemo(() => {
    const totalTickets = tickets.length
    const openCount = tickets.filter(t => !t.resolved).length
    const resolvedCount = totalTickets - openCount
    const resolveRate = totalTickets > 0 ? Math.round((resolvedCount / totalTickets) * 100) : 100

    // Ticket Volume Trend Chart
    const now = new Date()
    const days = dateRange === '7d' ? 7 : 30
    const trendData = []

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const dStr = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
      let openT = 0, resT = 0
      tickets.forEach(t => {
        if (new Date(t.created_at).toISOString().split('T')[0] === dStr) {
          if (t.resolved) resT++
          else openT++
        }
      })
      trendData.push({ date: label, OpenTickets: openT, ResolvedTickets: resT })
    }

    // Top Submitting Users (Bar Chart)
    const submitterCounts = {}
    tickets.forEach(t => {
      const uid = t.user_id || 'guest'
      submitterCounts[uid] = (submitterCounts[uid] || 0) + 1
    })

    const topSubmitters = Object.entries(submitterCounts)
      .map(([uid, count]) => {
        const displayName = userNames[uid]?.displayName || (uid !== 'guest' ? `User #${uid.slice(0, 8)}` : 'Guest User')
        return {
          name: displayName.length > 18 ? displayName.substring(0, 18) + '...' : displayName,
          count,
          uid
        }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // Status Breakdown Donut Chart
    const statusBreakdown = [
      { name: 'Open Tickets', value: openCount, color: TICKET_STATUS_COLORS[0] },
      { name: 'Resolved Tickets', value: resolvedCount, color: TICKET_STATUS_COLORS[1] }
    ].filter(b => b.value > 0)

    return {
      totalTickets, openCount, resolvedCount, resolveRate,
      trendData, topSubmitters, statusBreakdown
    }
  }, [tickets, dateRange, userNames])

  const filteredTickets = tickets.filter(item => {
    const msg = String(item.error_message || '').toLowerCase()
    const body = String(item.stack_trace || '').toLowerCase()
    const uid = String(item.user_id || '').toLowerCase()
    const submitterName = String(userNames[item.user_id]?.displayName || '').toLowerCase()
    const query = searchQuery.toLowerCase().trim()

    const matchesSearch = !query || msg.includes(query) || body.includes(query) || uid.includes(query) || submitterName.includes(query)
    if (!matchesSearch) return false

    if (filterStatus === 'open') return !item.resolved
    if (filterStatus === 'resolved') return item.resolved
    return true
  })

  return (
    <div className="animate-in">
      {/* ── Title & Refresh ──────────────────────────────────────────────── */}
      <div className="page-title-row">
        <div>
          <h1 className="page-title">In-App Support Ticket Center</h1>
          <p className="page-desc">Customer inquiry tickets, feature feedback, and direct resolution hub</p>
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
          <button className="btn btn-secondary" onClick={loadTickets} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Tickets
          </button>
        </div>
      </div>

      {/* ── SECTION 1: KPI SCORECARDS ────────────────────────────────────── */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Support Tickets</span>
            <div className="metric-icon badge-indigo"><MessageSquare size={18} /></div>
          </div>
          <div className="metric-value">{insights.totalTickets}</div>
          <div className="metric-subtext">All submitted user tickets</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Open Tickets</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {insights.openCount > 0 && (
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#f59e0b',
                  boxShadow: '0 0 10px #f59e0b', display: 'inline-block'
                }} className="animate-pulse" />
              )}
              <div className="metric-icon badge-amber"><Clock size={18} /></div>
            </div>
          </div>
          <div className="metric-value" style={{ color: insights.openCount > 0 ? 'var(--amber)' : 'var(--green)' }}>
            {insights.openCount}
          </div>
          <div className="metric-subtext">Awaiting admin reply</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Resolved Tickets</span>
            <div className="metric-icon badge-green"><CheckCircle size={18} /></div>
          </div>
          <div className="metric-value">{insights.resolvedCount}</div>
          <div className="metric-subtext">Successfully answered</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Resolution Efficiency</span>
            <div className="metric-icon badge-purple"><TrendingUp size={18} /></div>
          </div>
          <div className="metric-value">{insights.resolveRate}%</div>
          <div className="metric-subtext">Ticket closure rate</div>
        </div>
      </div>

      {/* ── SECTION 2: TICKET VOLUME TREND CHART ─────────────────────────── */}
      <div className="table-card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Support Inflow &amp; Resolution Volume</h3>
            <p className="metric-subtext" style={{ margin: 0 }}>Open vs resolved support requests over time</p>
          </div>
          <span className="badge badge-purple">{dateRange === '7d' ? '7-Day Overview' : '30-Day Overview'}</span>
        </div>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={insights.trendData}>
              <defs>
                <linearGradient id="tkOpen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tkRes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<SlateTooltip />} />
              <Area type="monotone" dataKey="OpenTickets" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#tkOpen)" name="Open Tickets" />
              <Area type="monotone" dataKey="ResolvedTickets" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#tkRes)" name="Resolved Tickets" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── SECTION 3: TOP SUBMITTERS & STATUS BREAKDOWN (2-Column Grid) ─── */}
      <div className="insights-grid" style={{ marginBottom: 24 }}>
        {/* Top Submitters Bar Chart */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Frequent Ticket Submitters</h3>
              <p className="metric-subtext" style={{ margin: 0 }}>Users logging the most inquiries</p>
            </div>
            <span className="badge badge-indigo"><User size={12} /> Users</span>
          </div>
          <div style={{ width: '100%', height: 220 }}>
            {insights.topSubmitters.length === 0 ? (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No support tickets yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.topSubmitters} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#475569" fontSize={10} width={110} tickLine={false} />
                  <Tooltip content={<SlateTooltip />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Tickets Submitted">
                    {insights.topSubmitters.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#8b5cf6' : i === 1 ? '#6366f1' : '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status Breakdown Donut Chart */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Ticket Status Ratio</h3>
              <p className="metric-subtext" style={{ margin: 0 }}>Open vs resolved inquiries</p>
            </div>
            <span className="badge badge-amber"><BarChart2 size={12} /> Status</span>
          </div>
          <div className="donut-card-body">
            <div style={{ width: 150, height: 150, flexShrink: 0 }}>
              {insights.statusBreakdown.length === 0 ? (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={insights.statusBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={40} outerRadius={66}
                      dataKey="value"
                      stroke="none"
                      paddingAngle={2}
                    >
                      {insights.statusBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<SlateTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="donut-legend">
              {insights.statusBreakdown.map((entry, i) => (
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

      {/* ── SECTION 4: MAIN SUPPORT TICKET TABLE ────────────────────────── */}
      <div className="table-card">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <MessageSquare size={18} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Support Tickets ({filteredTickets.length})</span>
            {insights.openCount > 0 && (
              <span className="badge badge-amber">{insights.openCount} Open</span>
            )}

            {/* Filter Tabs */}
            <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: 3, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <button
                className={`btn btn-sm ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none', padding: '3px 10px' }}
                onClick={() => setFilterStatus('all')}
              >
                All ({tickets.length})
              </button>
              <button
                className={`btn btn-sm ${filterStatus === 'open' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none', padding: '3px 10px' }}
                onClick={() => setFilterStatus('open')}
              >
                Open ({insights.openCount})
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
              placeholder="Search subject, user, message..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <LoadingScreen fullScreen={false} label="Loading Support Tickets..." sublabel="Fetching incoming user inquiries & responses" />
        ) : filteredTickets.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--green)' }}>
            ✓ No support tickets found for this filter!
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Subject</th>
                  <th>Submitter Identity</th>
                  <th>Submitted At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map(ticket => {
                  const subject = ticket.error_message.replace('[Support Ticket]', '').trim()
                  const priority = detectPriority(subject, ticket.stack_trace)
                  const submitterName = userNames[ticket.user_id]?.displayName || (ticket.user_id ? `User #${ticket.user_id.slice(0, 8)}` : 'Guest User')

                  return (
                    <tr key={ticket.id}>
                      <td>
                        {ticket.resolved ? (
                          <span className="badge badge-green"><CheckCircle size={12} /> Resolved</span>
                        ) : (
                          <span className="badge badge-amber"><Clock size={12} /> Open Ticket</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${priority.badgeClass}`}>{priority.label}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {subject}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                            {submitterName}
                          </span>
                          {ticket.user_id && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              ID: {ticket.user_id.slice(0, 10)}...
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(ticket.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => setActiveTicket(ticket)}>
                          <Eye size={12} /> View &amp; Reply
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Ticket Details & Reply Modal ─────────────────────────────────── */}
      {activeTicket && (
        <div className="modal-backdrop animate-in" onClick={() => { setActiveTicket(null); setReplyText(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 'min(720px, 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-gradient)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.9rem'
                }}>
                  {(userNames[activeTicket.user_id]?.displayName || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
                    {activeTicket.error_message.replace('[Support Ticket]', '').trim()}
                  </h3>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    From: {userNames[activeTicket.user_id]?.displayName || activeTicket.user_id || 'Anonymous'}
                  </div>
                </div>
              </div>
              {activeTicket.resolved ? (
                <span className="badge badge-green">Resolved</span>
              ) : (
                <span className="badge badge-amber">Open</span>
              )}
            </div>

            <div style={{
              background: 'var(--bg-primary)', padding: 16, borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem', marginBottom: 16, border: '1px solid var(--border-color)',
              lineHeight: 1.6
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                Customer Inquiry Message:
              </div>
              <p style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                {activeTicket.stack_trace || 'No detailed message provided.'}
              </p>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: 12, borderTop: '1px dashed var(--border-color)', paddingTop: 8 }}>
                Submitted: {new Date(activeTicket.created_at).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium' })}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Admin Internal Resolution Note / Response
              </label>
              <textarea
                className="search-input"
                style={{ width: '100%', height: 90, padding: 12, resize: 'none', lineHeight: 1.5 }}
                placeholder="Type resolution note or admin action details..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                className={`btn ${activeTicket.resolved ? 'btn-secondary' : 'btn-primary'}`}
                onClick={() => toggleTicketStatus(activeTicket.id, activeTicket.resolved)}
              >
                {activeTicket.resolved ? 'Reopen Ticket' : 'Mark as Resolved'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setActiveTicket(null); setReplyText(''); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
