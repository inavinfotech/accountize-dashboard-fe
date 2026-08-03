import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Register PWA Service Worker with auto-update & stale asset recovery
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // New service worker available — force update immediately to prevent
    // stale chunk references that cause white screens on dashboard reopen
    updateSW(true)
  },
  onOfflineReady() {
    console.log('[PWA] Dashboard is ready for offline use.')
  },
  onRegisterError(error) {
    console.error('[PWA] Service worker registration failed:', error)
  }
})

// Handle chunk load failures gracefully on server updates
window.addEventListener('vite:preloadError', () => {
  console.warn('New deployment detected or asset chunk failed to load. Reloading dashboard...')
  const reloaded = sessionStorage.getItem('chunk_reload')
  if (!reloaded) {
    sessionStorage.setItem('chunk_reload', 'true')
    window.location.reload()
  }
})

// Clear reload flag on clean app boot
sessionStorage.removeItem('chunk_reload')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
