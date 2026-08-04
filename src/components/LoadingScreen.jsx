import React from 'react'

/**
 * Premium LoadingScreen Component for Dashboard
 * Replaces plain text loading indicators across the admin application with
 * a rich animated logo badge, dual-ring spinner, and subtle progress indicator.
 */
export default function LoadingScreen({ 
  label = 'Loading Command Center...', 
  fullScreen = true,
  sublabel = 'Connecting to Accountize Admin System'
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: fullScreen ? '100vw' : '100%',
        height: fullScreen ? '100dvh' : '100%',
        minHeight: fullScreen ? '100vh' : '240px',
        background: fullScreen ? 'var(--bg-primary)' : 'transparent',
        padding: '32px 16px',
        boxSizing: 'border-box',
        zIndex: fullScreen ? 99999 : 'auto'
      }}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
        {/* Animated Dual Spinner Ring */}
        <div
          style={{
            position: 'absolute',
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            border: '3px solid rgba(99, 102, 241, 0.12)',
            borderTopColor: 'var(--accent-primary, #6366f1)',
            borderRightColor: '#3b82f6',
            animation: 'dashSpin 1s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite'
          }}
        />

        {/* Center Logo Icon */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'var(--bg-card, #ffffff)',
            border: '1px solid var(--border-color, rgba(226, 232, 240, 0.8))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.35)',
            animation: 'dashPulse 2s ease-in-out infinite'
          }}
        >
          <img src="/logo.svg" alt="Admin Logo" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
        </div>
      </div>

      {/* Label Typography */}
      <h3
        style={{
          fontSize: '1rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: '0 0 6px 0',
          letterSpacing: '-0.2px',
          textAlign: 'center'
        }}
      >
        {label}
      </h3>

      {sublabel && (
        <p
          style={{
            fontSize: '0.775rem',
            color: 'var(--text-muted)',
            margin: 0,
            textAlign: 'center',
            maxWidth: '320px',
            lineHeight: 1.4
          }}
        >
          {sublabel}
        </p>
      )}

      {/* Shimmer Indicator Line */}
      <div
        style={{
          width: '120px',
          height: '3px',
          background: 'var(--border-color, rgba(226, 232, 240, 0.6))',
          borderRadius: '3px',
          marginTop: '18px',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '40%',
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
            borderRadius: '3px',
            animation: 'dashShimmer 1.4s ease-in-out infinite'
          }}
        />
      </div>

      <style>{`
        @keyframes dashSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes dashPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.35); }
          50% { transform: scale(1.04); box-shadow: 0 14px 30px -4px rgba(99, 102, 241, 0.55); }
        }
        @keyframes dashShimmer {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  )
}
