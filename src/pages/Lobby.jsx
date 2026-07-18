import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'

function Lobby() {
  const { sessionId } = useParams()
  const { session } = useAuth()
  const [joueurs, setJoueurs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function rejoindreSession() {
      await supabase.from('joueurs').insert({
        session_id: sessionId,
        pseudo: session.user.user_metadata.full_name,
        spotify_id: session.user.user_metadata.provider_id,
      })
      // On ignore volontairement le résultat/erreur ici :
      // si le joueur existe déjà, la contrainte unique de la base
      // rejette l'insertion, et c'est très bien comme ça.

      const { data: liste } = await supabase
        .from('joueurs')
        .select('*')
        .eq('session_id', sessionId)

      setJoueurs(liste || [])
      setLoading(false)
    }

    if (session) rejoindreSession()
  }, [sessionId, session])

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Chargement...</div>

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Lobby</h1>
      <p className="text-gray-400 text-sm">Session ID : {sessionId}</p>

      <div className="flex flex-col gap-2 mt-4">
        <h2 className="text-lg">Joueurs présents :</h2>
        {joueurs.map((j) => (
          <p key={j.id}>{j.pseudo}</p>
        ))}
      </div>
    </div>
  )
}

export default Lobby