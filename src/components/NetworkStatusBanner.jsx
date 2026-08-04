import { useState, useEffect } from 'react'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function NetworkStatusBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [showRestored, setShowRestored] = useState(false)

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true)
      setShowRestored(false)
    }

    const handleOnline = async () => {
      setIsOffline(false)
      setShowRestored(true)

      // Automatically retry/refresh Supabase session on reconnect
      try {
        await supabase.auth.getSession()
      } catch (err) {
        console.warn('[Network] Session refresh on reconnect:', err)
      }

      const timer = setTimeout(() => {
        setShowRestored(false)
      }, 3500)

      return () => clearTimeout(timer)
    }

    // Suppress network disconnect errors from logging noisy unhandled rejections
    const handleRejection = (event) => {
      const reason = event.reason
      const msg = String(reason?.message || reason || '').toLowerCase()
      if (
        !navigator.onLine ||
        msg.includes('err_internet_disconnected') ||
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed')
      ) {
        setIsOffline(true)
        event.preventDefault() // Prevents noisy unhandled promise rejection popups
      }
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  if (!isOffline && !showRestored) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 999999,
        background: isOffline
          ? 'linear-gradient(90deg, #b45309 0%, #d97706 100%)'
          : 'linear-gradient(90deg, #059669 0%, #10b981 100%)',
        color: '#ffffff',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontSize: '0.8rem',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        boxSizing: 'border-box'
      }}
    >
      {isOffline ? (
        <>
          <WifiOff size={16} style={{ flexShrink: 0 }} />
          <span>Admin Offline — Internet Connection Lost. Reconnecting automatically when restored.</span>
          <button
            onClick={async () => {
              try {
                const res = await fetch('/manifest.json', { method: 'HEAD', cache: 'no-store' })
                if (res.ok) {
                  setIsOffline(false)
                  setShowRestored(true)
                  await supabase.auth.getSession()
                }
              } catch {
                // Still offline
              }
            }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.725rem',
              marginLeft: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RefreshCw size={12} /> Retry
          </button>
        </>
      ) : (
        <>
          <Wifi size={16} style={{ flexShrink: 0 }} />
          <span>Admin Connection Restored — Reconnected successfully!</span>
        </>
      )}
    </div>
  )
}
