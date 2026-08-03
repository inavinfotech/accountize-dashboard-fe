/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkAdminRole = (userObj) => {
    if (!userObj) return false
    // Checks if user metadata or app metadata contains is_admin flag, or email is explicit admin
    const isMetaAdmin = userObj.user_metadata?.is_admin === true || userObj.app_metadata?.is_admin === true
    const isOwnerEmail = userObj.email?.endsWith('@inexarum.com') || userObj.email?.endsWith('@inexarum.in') || userObj.email === 'admin@accountify.app'
    return isMetaAdmin || isOwnerEmail
  }

  useEffect(() => {
    async function getInitialSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        const currentUser = session?.user ?? null
        setUser(currentUser)
        setIsAdmin(checkAdminRole(currentUser))
      } catch (err) {
        console.error('[AdminAuth] Error checking session:', err)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      const currentUser = session?.user ?? null
      setUser(currentUser)
      setIsAdmin(checkAdminRole(currentUser))
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signInAdmin = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (!checkAdminRole(data.user)) {
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
