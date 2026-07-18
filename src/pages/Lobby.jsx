import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'

function Lobby() {
  const { sessionId } = useParams()
  const { session } = useAuth()
  const [joueurs, setJoueurs] = useState([])
  const [sessionData, setSessionData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      // Récupère les infos de la session (thème, créateur, statut)
      const { data: sessionInfo } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      setSessionData(sessionInfo)

      // Ajoute l'utilisateur actuel comme joueur (ignoré si déjà présent)
      await supabase.from('joueurs').insert({
        session_id: sessionId,
        pseudo: session.user.user_metadata.full_name,
        spotify_id: session.user.user_metadata.provider_id,
      })

      // Récupère la liste des joueurs
      const { data: liste } = await supabase
        .from('joueurs')
        .select('*')
        .eq('session_id', sessionId)

      setJoueurs(liste || [])
      setLoading(false)
    }

    if (session) init()

    // Abonnement temps réel : nouveaux joueurs
    const channelJoueurs = supabase
      .channel(`joueurs-session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'joueurs', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setJoueurs((prev) => [...prev, payload.new])
        }
      )
      .subscribe()

    // Abonnement temps réel : changement de statut de la session
    const channelSession = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          setSessionData(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelJoueurs)
      supabase.removeChannel(channelSession)
    }
  }, [sessionId, session])

  const demarrerSession = async () => {
    await supabase
      .from('sessions')
      .update({ status: 'collecting' })
      .eq('id', sessionId)
  }

  if (loading || !sessionData) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Chargement...</div>
  }

  const estCreateur = session.user.id === sessionData.created_by

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Lobby</h1>
      <p className="text-gray-400 text-sm">Thème : {sessionData.theme}</p>
      <p className="text-gray-400 text-sm">Statut : {sessionData.status}</p>

      <div className="flex flex-col gap-2 mt-4">
        <h2 className="text-lg">Joueurs présents :</h2>
        {joueurs.map((j) => (
          <p key={j.id}>{j.pseudo}</p>
        ))}
      </div>

      {estCreateur && sessionData.status === 'lobby' && (
        <button
          onClick={demarrerSession}
          className="bg-green-500 text-black px-6 py-2 rounded-full font-bold mt-4"
        >
          Démarrer
        </button>
      )}
    </div>
  )
}

export default Lobby