import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // On réinjecte le token Spotify sauvegardé manuellement, s'il existe
      const savedToken = localStorage.getItem('spotify_provider_token')
      if (session && savedToken) {
        session.provider_token = savedToken
      }
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // À la connexion, Supabase fournit le vrai provider_token : on le sauvegarde
        if (event === 'SIGNED_IN' && session?.provider_token) {
          localStorage.setItem('spotify_provider_token', session.provider_token)
        }

        if (event === 'SIGNED_OUT') {
          localStorage.removeItem('spotify_provider_token')
        }

        // On réinjecte le token sauvegardé si la session actuelle ne l'a pas
        const savedToken = localStorage.getItem('spotify_provider_token')
        if (session && savedToken && !session.provider_token) {
          session.provider_token = savedToken
        }

        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const loginWithSpotify = () => {
    supabase.auth.signInWithOAuth({
      provider: 'spotify',
      options: {
        scopes: 'user-read-email user-read-private',
      },
    })
  }

  const logout = () => {
    localStorage.removeItem('spotify_provider_token')
    supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, loading, loginWithSpotify, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}