import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import LoadingScreen from '../components/LoadingScreen'
import {
  DollarSign, TrendingUp, CreditCard, Wallet, Users, Search, Download,
  ArrowUpRight, FileText, RefreshCw, CheckCircle2, Award
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts'

export default function AccountsFinance() {
  const [loading, setLoading] = useState(true)
  const [receipts, setReceipts] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [billingFilter, setBillingFilter] = useState('all') // 'all', 'monthly', 'annual'
  const [refreshing, setRefreshing] = useState(false)

  const loadFinancialData = async () => {
    try {
      setLoading(true)

      // 1. Fetch payment receipts
      let receiptData = []
      const { data: rpcReceipts, error: rpcErr } = await supabase.rpc('admin_get_all_payment_receipts')
      if (!rpcErr && rpcReceipts) {
        receiptData = rpcReceipts
      } else {
        const { data: rawReceipts } = await supabase
          .from('payment_receipts')
          .select('*, user_id')
          .order('created_at', { ascending: false })
        receiptData = (rawReceipts || []).map(r => ({
          receipt_id: r.id,
          user_id: r.user_id,
          user_email: r.user_id?.slice(0, 8) || 'N/A',
          display_name: 'Subscriber',
          receipt_number: r.receipt_number,
          plan: r.plan,
          billing_cycle: r.billing_cycle,
          amount: r.amount,
          currency: r.currency || 'INR',
          payment_order_id: r.payment_order_id,
          payment_id: r.payment_id,
          created_at: r.created_at
        }))
      }

      // 2. Fetch active subscriptions to calculate MRR / ARR
      let subData = []
      const { data: rpcSubs, error: subErr } = await supabase.rpc('admin_get_all_subscriptions')
      if (!subErr && rpcSubs) {
        subData = rpcSubs
      } else {
        const { data: rawSubs } = await supabase.from('subscriptions').select('*')
        subData = rawSubs || []
      }

      setReceipts(receiptData)
      setSubscriptions(subData)
    } catch (err) {
      console.error('Failed to load financial data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadFinancialData()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    loadFinancialData()
  }

  // ── Calculated Financial Key Performance Indicators (KPIs) ───────────────
  const metrics = useMemo(() => {
    const totalGrossRevenue = receipts.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)

    const activeProSubs = subscriptions.filter(s => s.plan === 'pro' && s.status === 'active')
    const activeTrialSubs = subscriptions.filter(s => s.status === 'trialing')
    const freeSubs = subscriptions.filter(s => s.plan === 'free' && s.status === 'active')

    // Calculate MRR
    let mrr = 0
    activeProSubs.forEach(s => {
      if (s.billing_cycle === 'annual') {
        mrr += 1499 / 12 // ~124.91/mo
      } else {
        mrr += 149 // ₹149/mo
      }
    })

    const arr = mrr * 12
    const totalProUsersCount = activeProSubs.length
    const arpu = totalProUsersCount > 0 ? (mrr / totalProUsersCount) : 0

    return {
      totalGrossRevenue,
      mrr: Math.round(mrr),
      arr: Math.round(arr),
      totalProUsersCount,
      activeTrialSubsCount: activeTrialSubs.length,
      freeSubsCount: freeSubs.length,
      arpu: Math.round(arpu),
      totalTransactions: receipts.length
    }
  }, [receipts, subscriptions])

  // ── Monthly Revenue Chart Aggregation ──────────────────────────────────
  const monthlyChartData = useMemo(() => {
    const monthsMap = {}
    receipts.forEach(r => {
      if (!r.created_at) return
      const date = new Date(r.created_at)
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (!monthsMap[monthKey]) monthsMap[monthKey] = 0
      monthsMap[monthKey] += Number(r.amount) || 0
    })

    const keys = Object.keys(monthsMap)
    if (keys.length === 0) {
      return [{ month: 'Current', revenue: metrics.totalGrossRevenue }]
    }
    return keys.map(m => ({ month: m, revenue: monthsMap[m] }))
  }, [receipts, metrics.totalGrossRevenue])

  // ── Distribution Pie Chart Data ─────────────────────────────────────────
  const planDistribution = useMemo(() => [
    { name: 'Monthly Pro', value: subscriptions.filter(s => s.plan === 'pro' && s.billing_cycle === 'monthly').length || 1, color: '#6366f1' },
    { name: 'Annual Pro', value: subscriptions.filter(s => s.plan === 'pro' && s.billing_cycle === 'annual').length || 0, color: '#f59e0b' },
    { name: 'Pro Trial', value: metrics.activeTrialSubsCount, color: '#3b82f6' },
    { name: 'Starter Free', value: metrics.freeSubsCount, color: '#64748b' }
  ], [subscriptions, metrics])

  // ── Filtered Receipt Ledger List ─────────────────────────────────────────
  const filteredReceipts = useMemo(() => {
    return receipts.filter(r => {
      const matchesSearch =
        !searchQuery ||
        (r.receipt_number && r.receipt_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.user_email && r.user_email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.payment_order_id && r.payment_order_id.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesBilling =
        billingFilter === 'all' || r.billing_cycle === billingFilter

      return matchesSearch && matchesBilling
    })
  }, [receipts, searchQuery, billingFilter])

  // CSV Exporter
  const exportCSVLedger = () => {
    if (!filteredReceipts.length) return
    const headers = ['Receipt Number', 'User Email', 'Billing Cycle', 'Amount (INR)', 'Order ID', 'Payment ID', 'Date']
    const rows = filteredReceipts.map(r => [
      r.receipt_number,
      r.user_email,
      r.billing_cycle,
      r.amount,
      r.payment_order_id || 'N/A',
      r.payment_id || 'N/A',
      new Date(r.created_at).toLocaleString()
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Accountize_Revenue_Ledger_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Print / PDF Receipt Exporter for Super Admin
  const printAdminReceipt = (rcpt) => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Receipt ${rcpt.receipt_number}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #0f172a; }
            .header { border-bottom: 2px solid #6366f1; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
            .badge { background: #fef3c7; color: #b45309; font-weight: bold; padding: 4px 10px; border-radius: 4px; font-size: 12px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            .table th, .table td { border: 1px solid #e2e8f0; padding: 10px 14px; text-align: left; font-size: 14px; }
            .table th { background: #f8fafc; font-weight: 700; }
            .total { font-size: 18px; font-weight: 800; color: #6366f1; margin-top: 24px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">Accountize Pro Payment Receipt</h1>
              <p style="color:#64748b; font-size:12px; margin-top:4px;">app.accountize.in • Super Admin Verified</p>
            </div>
            <span class="badge">PAID IN FULL</span>
          </div>

          <p><strong>Receipt #:</strong> ${rcpt.receipt_number}</p>
          <p><strong>User Email:</strong> ${rcpt.user_email}</p>
          <p><strong>Date:</strong> ${new Date(rcpt.created_at).toLocaleString('en-IN')}</p>
          <p><strong>Razorpay Order ID:</strong> ${rcpt.payment_order_id || 'N/A'}</p>

          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Billing Tenure</th>
                <th>Amount Paid</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Accountize Pro Plan Subscription</td>
                <td>${rcpt.billing_cycle === 'annual' ? 'Annual (12 Months)' : 'Monthly (1 Month)'}</td>
                <td>₹${rcpt.amount}</td>
              </tr>
            </tbody>
          </table>

          <div class="total">Total Gross Paid: ₹${rcpt.amount}</div>

          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `)
    win.document.close()
  }

  if (loading) {
    return <LoadingScreen fullScreen={false} label="Loading Accounts & Revenue Center..." sublabel="Fetching revenue ledgers & subscription metrics" />
  }

  return (
    <div className="admin-page animate-in">
      {/* ── Title & Controls Header ───────────────────────────────────── */}
      <div className="page-title-row">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Wallet size={22} color="var(--indigo)" /> Accounts &amp; Revenue Center
          </h1>
          <p className="page-desc">Real-time financial performance, MRR/ARR metrics, and transaction ledgers</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={exportCSVLedger} disabled={!filteredReceipts.length}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── KPI Cards Grid ────────────────────────────────────────────── */}
      <div className="metrics-grid">
        {/* Total Revenue */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Gross Revenue</span>
            <div className="metric-icon badge-blue"><DollarSign size={18} /></div>
          </div>
          <div className="metric-value">₹{metrics.totalGrossRevenue.toLocaleString('en-IN')}</div>
          <div className="metric-subtext" style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowUpRight size={12} /> All-time platform earnings
          </div>
        </div>

        {/* MRR */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Monthly Recurring (MRR)</span>
            <div className="metric-icon badge-green"><TrendingUp size={18} /></div>
          </div>
          <div className="metric-value">₹{metrics.mrr.toLocaleString('en-IN')}<span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>/mo</span></div>
          <div className="metric-subtext" style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CheckCircle2 size={12} /> Normalized Pro run rate
          </div>
        </div>

        {/* ARR */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Annual Recurring (ARR)</span>
            <div className="metric-icon badge-purple"><Award size={18} /></div>
          </div>
          <div className="metric-value">₹{metrics.arr.toLocaleString('en-IN')}<span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>/yr</span></div>
          <div className="metric-subtext" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={12} /> Projected 12-month revenue
          </div>
        </div>

        {/* Pro Subscribers */}
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-label">Active Pro Subscribers</span>
            <div className="metric-icon badge-amber"><Users size={18} /></div>
          </div>
          <div className="metric-value">{metrics.totalProUsersCount}</div>
          <div className="metric-subtext">
            ARPU: ₹{metrics.arpu}/mo per user
          </div>
        </div>
      </div>

      {/* ── Charts Grid Row ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Revenue Trend Chart */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Monthly Revenue Collections</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Gross Collections (INR)</span>
          </div>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={11} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={v => `₹${v}`} />
                <Tooltip
                  formatter={(val) => [`₹${val}`, 'Gross Revenue']}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.8rem' }}
                />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subscription Plan Distribution */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: 16 }}>
            Subscription Tier Distribution
          </div>
          <div style={{ width: '100%', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {planDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val) => [`${val} users`, 'Count']}
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.8rem' }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '0.75rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Transaction & Receipt Ledger Table ──────────────────────────── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} color="var(--indigo)" />
            <span style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--text-primary)' }}>
              Transaction &amp; Invoice Ledger ({filteredReceipts.length})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 10 }} />
              <input
                type="text"
                className="search-input"
                style={{ paddingLeft: 34, width: 220, fontSize: '0.8rem' }}
                placeholder="Search Receipt, Email, Order ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filter */}
            <select
              value={billingFilter}
              onChange={e => setBillingFilter(e.target.value)}
              style={{
                padding: '6px 12px', borderRadius: 6,
                border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 600, outline: 'none'
              }}
            >
              <option value="all">All Cycles</option>
              <option value="monthly">Monthly Pro</option>
              <option value="annual">Annual Pro</option>
            </select>
          </div>
        </div>

        {filteredReceipts.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.825rem' }}>
            No payment transaction receipts found matching your filter criteria.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Receipt Number</th>
                  <th>Customer Email</th>
                  <th>Plan &amp; Tenure</th>
                  <th>Amount</th>
                  <th>Payment Ref / Order ID</th>
                  <th>Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map(rcpt => (
                  <tr key={rcpt.receipt_id || rcpt.receipt_number}>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: '0.825rem', fontFamily: 'monospace', color: 'var(--indigo)' }}>
                        {rcpt.receipt_number}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.825rem', color: 'var(--text-primary)' }}>
                        {rcpt.display_name || 'Subscriber'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {rcpt.user_email}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${rcpt.billing_cycle === 'annual' ? 'badge-amber' : 'badge-blue'}`}>
                        {rcpt.billing_cycle === 'annual' ? 'Annual Pro' : 'Monthly Pro'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--green)' }}>
                        ₹{rcpt.amount}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {rcpt.payment_order_id ? rcpt.payment_order_id : 'Manual Upgrade'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {new Date(rcpt.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                        onClick={() => printAdminReceipt(rcpt)}
                        title="Print / View Invoice PDF"
                      >
                        <FileText size={12} /> Invoice PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
