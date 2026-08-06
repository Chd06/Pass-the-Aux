import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

// Génère un code aléatoire à 6 chiffres
function genererCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function Home() {
  const { session, logout } = useAuth()
  const [theme, setTheme] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)

  const [codeSaisi, setCodeSaisi] = useState('')
  const [joining, setJoining] = useState(false)
  const [errorJoin, setErrorJoin] = useState(null)

  const navigate = useNavigate()

  if (!session) return <Navigate to="/login" />

  // Le pseudo Spotify de l'utilisateur, avec un repli sur l'email si jamais absent
  const pseudo = session.user.user_metadata.full_name || session.user.email

  const handleCreateSession = async (e) => {
    e.preventDefault()
    if (!theme.trim()) return

    setCreating(true)
    setError(null)

    // On tente d'insérer avec un code aléatoire ; si le code existe déjà
    // (très rare, mais possible), on réessaie avec un nouveau code.
    let data = null
    let error = null

    for (let tentative = 0; tentative < 5; tentative++) {
      const code = genererCode()
      const result = await supabase
        .from('sessions')
        .insert({
          theme: theme.trim(),
          created_by: session.user.id,
          join_code: code,
        })
        .select()
        .single()

      if (!result.error) {
        data = result.data
        error = null
        break
      }

      if (result.error.code !== '23505') {
        error = result.error
        break
      }
      error = result.error
    }

    setCreating(false)

    if (error || !data) {
      setError(error?.message || 'Impossible de créer la session, réessaie.')
      return
    }

    navigate(`/session/${data.id}`)
  }

  const handleJoinSession = async (e) => {
    e.preventDefault()
    if (!codeSaisi.trim()) return

    setJoining(true)
    setErrorJoin(null)

    const { data, error } = await supabase
      .from('sessions')
      .select('id')
      .eq('join_code', codeSaisi.trim())
      .maybeSingle()

    setJoining(false)

    if (error || !data) {
      setErrorJoin('Code introuvable, vérifie-le et réessaie.')
      return
    }

    navigate(`/session/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl">Connecté en tant que {pseudo}</h1>

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
          className="bg-green-500 text-black px-6 py-2 rounded-full font-bold cursor-pointer hover:bg-green-400 transition disabled:opacity-50"
        >
          {creating ? 'Création...' : 'Créer une session'}
        </button>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>

      <div className="text-gray-500 text-sm">ou</div>

      <form onSubmit={handleJoinSession} className="flex flex-col gap-3 w-full max-w-sm">
        <input
          type="text"
          placeholder="Code à 6 chiffres"
          value={codeSaisi}
          onChange={(e) => setCodeSaisi(e.target.value)}
          maxLength={6}
          className="px-4 py-2 rounded-full text-black bg-white text-center tracking-widest font-mono"
        />
        <button
          type="submit"
          disabled={joining}
          className="bg-white text-black px-6 py-2 rounded-full font-bold cursor-pointer hover:bg-gray-200 transition disabled:opacity-50"
        >
          {joining ? 'Recherche...' : 'Rejoindre une session'}
        </button>
        {errorJoin && <p className="text-red-500 text-sm">{errorJoin}</p>}
      </form>

      <button onClick={logout} className="text-gray-400 underline cursor-pointer hover:text-gray-200 transition">
        Se déconnecter
      </button>
    </div>
  )
}

export default Home