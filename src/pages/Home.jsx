import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

function Home() {
  const { session, logout } = useAuth()
  const [theme, setTheme] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  if (!session) return <Navigate to="/login" />

  const handleCreateSession = async (e) => {
    e.preventDefault()
    if (!theme.trim()) return

    setCreating(true)
    setError(null)

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        theme: theme.trim(),
        created_by: session.user.id,
      })
      .select()
      .single()

    setCreating(false)

    if (error) {
      setError(error.message)
      return
    }

    navigate(`/session/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl">Connecté en tant que {session.user.email}</h1>

      <form onSubmit={handleCreateSession} className="flex flex-col gap-3 w-full max-w-sm">   
        <input
          type="text"
          placeholder="Thème de la session (ex: road trip de nuit)"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          className="px-4 py-2 rounded-full text-black bg-white"
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-white text-black px-6 py-2 rounded-full font-bold disabled:opacity-50"
        >
          {creating ? 'Création...' : 'Créer une session'}
        </button>
      </form>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button onClick={logout} className="text-gray-400 underline">
        Se déconnecter
      </button>
    </div>
  )
}

export default Home