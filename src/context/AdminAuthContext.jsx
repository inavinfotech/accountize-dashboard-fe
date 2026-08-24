/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkAdminRole = async (userObj) => {
    if (!userObj) return false
    try {
      // Check server-side is_admin() database function or app_metadata
      const { data, error } = await supabase.rpc('is_admin')
      if (!error && data === true) return true
    } catch {
      // ignore rpc errors
    }
    const isAppAdmin = userObj.app_metadata?.is_admin === true
    const isOwnerEmail = userObj.email?.endsWith('@inexarum.com') || userObj.email?.endsWith('@inexarum.in') || userObj.email === 'admin@accountize.app'
    return isAppAdmin || isOwnerEmail
  }

  useEffect(() => {
    async function getInitialSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        const currentUser = session?.user ?? null
        setUser(currentUser)
        const adminStatus = await checkAdminRole(currentUser)
        setIsAdmin(adminStatus)
      } catch (err) {
        console.error('[AdminAuth] Error checking session:', err)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      const currentUser = session?.user ?? null
      setUser(currentUser)
      const adminStatus = await checkAdminRole(currentUser)
      setIsAdmin(adminStatus)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInAdmin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    const adminStatus = await checkAdminRole(data.user)
    if (!adminStatus) {
      await supabase.auth.signOut()
      throw new Error('Access Denied: Account does not possess Super Admin privileges.')
    }
    return data
  }

  const signOutAdmin = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AdminAuthContext.Provider value={{ user, session, isAdmin, loading, signInAdmin, signOutAdmin }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}
