import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/shared/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // Tracks whether the profile fetch has completed (success or fail).
  // Stays false until we've attempted a fetch for the current user.
  // This prevents ProtectedRoute from making role decisions before the profile arrives.
  const [profileLoaded, setProfileLoaded] = useState(false)

  async function fetchProfile(userId) {
    setProfileLoaded(false)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) {
      console.error('[AuthContext] Profile fetch error:', error.message)
    }
    console.log('[AuthContext] Profile loaded:', data)
    setProfile(data ?? null)
    setProfileLoaded(true)
    return data ?? null
  }

  async function refreshProfile() {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) return
    await fetchProfile(currentUser.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Session:', session)
      console.log('User ID:', session?.user?.id)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // Fetch profile every time auth state changes with a user.
        // profileLoaded is reset to false inside fetchProfile before the query runs.
        fetchProfile(session.user.id).catch(console.error)
      } else {
        setProfile(null)
        setProfileLoaded(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    let fetchedProfile = null
    if (data.user) {
      fetchedProfile = await fetchProfile(data.user.id)
    }
    return { ...data, profile: fetchedProfile }
  }

  async function signUp({ email, password, fullName, studentId }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, student_id: studentId },
      },
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
    setProfileLoaded(false)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileLoaded, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
