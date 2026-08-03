import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Admin Dashboard] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
)

/**
 * Fetches user display names & emails from public.user_profiles view or fallbacks.
 */
export async function fetchUserProfiles() {
  const profileMap = {}

  try {
    // 1. Try public.user_profiles view (from auth.users)
    const { data: viewData, error: viewError } = await supabase
      .from('user_profiles')
      .select('user_id, display_name, email, created_at')

    if (!viewError && viewData && viewData.length > 0) {
      viewData.forEach(p => {
        if (p.user_id) {
          profileMap[p.user_id] = {
            user_id: p.user_id,
            displayName: p.display_name || p.email || `User #${p.user_id.slice(0, 8)}`,
            email: p.email || null,
            created_at: p.created_at || new Date().toISOString()
          }
        }
      })
      return profileMap
    }
  } catch (_) { /* ignore view fallback */ }

  // 2. Fallback: Query accounts table
  try {
    const { data: accData } = await supabase.from('accounts').select('user_id, name, created_at')
    if (accData) {
      accData.forEach(a => {
        if (a.user_id && !profileMap[a.user_id]) {
          profileMap[a.user_id] = {
            user_id: a.user_id,
            displayName: a.name || `User #${a.user_id.slice(0, 8)}`,
            email: null,
            created_at: a.created_at || new Date().toISOString()
          }
        }
      })
    }
  } catch (_) {}

  // 3. Fallback: Query analytics_events metadata for email
  try {
    const { data: evtData } = await supabase
      .from('analytics_events')
      .select('user_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(500)

    if (evtData) {
      evtData.forEach(e => {
        const mail = e.metadata?.email || e.metadata?.user_email
        if (e.user_id && (!profileMap[e.user_id] || profileMap[e.user_id].displayName.startsWith('User #'))) {
          profileMap[e.user_id] = {
            user_id: e.user_id,
            displayName: mail || `User #${e.user_id.slice(0, 8)}`,
            email: mail || null,
            created_at: e.created_at || new Date().toISOString()
          }
        }
      })
    }
  } catch (_) {}

  return profileMap
}
