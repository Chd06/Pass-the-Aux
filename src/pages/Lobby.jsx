import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'

const MAX_MORCEAUX_PAR_JOUEUR = 3

function Lobby() {
  const { sessionId } = useParams()
  const { session } = useAuth()
  const [joueurs, setJoueurs] = useState([])
  const [sessionData, setSessionData] = useState(null)
  const [monJoueurId, setMonJoueurId] = useState(null)
  const [loading, setLoading] = useState(true)

  const [recherche, setRecherche] = useState('')
  const [resultats, setResultats] = useState([])
  const [mesMorceaux, setMesMorceaux] = useState([])

  const [morceauxVote, setMorceauxVote] = useState([])
  const [mesVotes, setMesVotes] = useState({})

  useEffect(() => {
    async function init() {
      const { data: sessionInfo } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      setSessionData(sessionInfo)

      const spotifyId = session.user.user_metadata.provider_id

      await supabase.from('joueurs').insert({
        session_id: sessionId,
        pseudo: session.user.user_metadata.full_name,
        spotify_id: spotifyId,
      })

      const { data: monJoueur } = await supabase
        .from('joueurs')
        .select('id')
        .eq('session_id', sessionId)
        .eq('spotify_id', spotifyId)
        .single()

      setMonJoueurId(monJoueur?.id || null)

      const { data: liste } = await supabase
        .from('joueurs')
        .select('*')
        .eq('session_id', sessionId)

      setJoueurs(liste || [])

      const { data: morceaux } = await supabase
        .from('morceaux')
        .select('*')
        .eq('session_id', sessionId)
        .eq('ajoute_par', monJoueur?.id)

      setMesMorceaux(morceaux || [])
      setLoading(false)
    }

    if (session) init()

    const channelJoueurs = supabase
      .channel(`joueurs-session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'joueurs', filter: `session_id=eq.${sessionId}` },
        (payload) => setJoueurs((prev) => [...prev, payload.new])
      )
      .subscribe()

    const channelSession = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => setSessionData(payload.new)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channelJoueurs)
      supabase.removeChannel(channelSession)
    }
  }, [sessionId, session])

  // Dès que le statut passe à "voting", on charge les morceaux à voter
  useEffect(() => {
    async function chargerMorceauxPourVote() {
      // On ne sélectionne SURTOUT PAS "ajoute_par" ici, pour préserver l'anonymat
      const { data } = await supabase
        .from('morceaux')
        .select('id, titre, artiste, spotify_track_id')
        .eq('session_id', sessionId)

      // On mélange l'ordre une seule fois avec un tri aléatoire
      const melanges = [...(data || [])].sort(() => Math.random() - 0.5)
      setMorceauxVote(melanges)
    }

    if (sessionData?.status === 'voting') {
      chargerMorceauxPourVote()
    }
  }, [sessionData?.status, sessionId])

  const demarrerSession = async () => {
    await supabase.from('sessions').update({ status: 'collecting' }).eq('id', sessionId)
  }

  const passerAuVote = async () => {
    await supabase.from('sessions').update({ status: 'voting' }).eq('id', sessionId)
  }

  const rechercherMorceaux = async (e) => {
    e.preventDefault()
    if (!recherche.trim()) return

    const token = session.provider_token

    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(recherche)}&type=track&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json()
    setResultats(data.tracks?.items || [])
  }

  const ajouterMorceau = async (track) => {
    if (!monJoueurId) return
    if (mesMorceaux.length >= MAX_MORCEAUX_PAR_JOUEUR) return

    const { data, error } = await supabase
      .from('morceaux')
      .insert({
        session_id: sessionId,
        ajoute_par: monJoueurId,
        spotify_track_id: track.id,
        titre: track.name,
        artiste: track.artists.map((a) => a.name).join(', '),
      })
      .select()
      .single()

    if (error) {
      console.error('Erreur ajout morceau:', error)
      return
    }

    setMesMorceaux((prev) => [...prev, data])
    setResultats([])
    setRecherche('')
  }

  const voter = async (morceauId, suspectId) => {
    setMesVotes((prev) => ({ ...prev, [morceauId]: suspectId }))

    // "upsert" : insère le vote, ou le met à jour s'il existe déjà (grâce à la contrainte unique)
    const { error } = await supabase
      .from('votes')
      .upsert(
        {
          morceau_id: morceauId,
          votant_id: monJoueurId,
          suppose_auteur_id: suspectId,
        },
        { onConflict: 'morceau_id,votant_id' }
      )

    if (error) {
      console.error('Erreur vote:', error)
    }
  }

  if (loading || !sessionData) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Chargement...</div>
  }

  const estCreateur = session.user.id === sessionData.created_by
  const limiteAtteinte = mesMorceaux.length >= MAX_MORCEAUX_PAR_JOUEUR

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-4 py-8">
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
          className="bg-green-500 text-black px-6 py-2 rounded-full font-bold cursor-pointer hover:bg-green-400 transition"
        >
          Démarrer
        </button>
      )}

      {sessionData.status === 'collecting' && (
        <div className="w-full max-w-md mt-4 flex flex-col gap-3">
          <p className="text-sm text-gray-400 text-center">
            {mesMorceaux.length} / {MAX_MORCEAUX_PAR_JOUEUR} morceaux ajoutés
          </p>

          {limiteAtteinte ? (
            <p className="text-center text-green-400 font-bold">
              Limite atteinte, tu ne peux plus ajouter de morceaux 🎉
            </p>
          ) : (
            <>
              <form onSubmit={rechercherMorceaux} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Rechercher un morceau..."
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-full text-black bg-white"
                />
                <button
                  type="submit"
                  className="bg-white text-black px-4 py-2 rounded-full font-bold cursor-pointer hover:bg-gray-200 transition"
                >
                  🔍
                </button>
              </form>

              {resultats.map((track) => (
                <div key={track.id} className="flex justify-between items-center bg-gray-800 px-4 py-2 rounded-lg">
                  <span>{track.name} — {track.artists.map((a) => a.name).join(', ')}</span>
                  <button
                    onClick={() => ajouterMorceau(track)}
                    className="bg-green-500 text-black px-3 py-1 rounded-full text-sm font-bold cursor-pointer hover:bg-green-400 transition"
                  >
                    Ajouter
                  </button>
                </div>
              ))}
            </>
          )}

          <div className="mt-4">
            <h3 className="text-lg">Mes morceaux ajoutés :</h3>
            {mesMorceaux.map((m) => (
              <p key={m.id} className="text-gray-300">{m.titre} — {m.artiste}</p>
            ))}
          </div>

          {estCreateur && (
            <button
              onClick={passerAuVote}
              className="bg-white text-black px-6 py-2 rounded-full font-bold cursor-pointer hover:bg-gray-200 transition mt-4"
            >
              Passer au vote
            </button>
          )}
        </div>
      )}

      {sessionData.status === 'voting' && (
        <div className="w-full max-w-md mt-4 flex flex-col gap-4">
          <h2 className="text-lg text-center">Devine qui a ajouté quoi 🕵️</h2>

          {morceauxVote.map((m) => (
            <div key={m.id} className="bg-gray-800 px-4 py-3 rounded-lg flex flex-col gap-2">
              <span>{m.titre} — {m.artiste}</span>
              <select
                value={mesVotes[m.id] || ''}
                onChange={(e) => voter(m.id, e.target.value)}
                className="px-3 py-1 rounded text-black bg-white"
              >
                <option value="" disabled>Qui a ajouté ça ?</option>
                {joueurs.map((j) => (
                  <option key={j.id} value={j.id}>{j.pseudo}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      <button className="text-gray-400 underline cursor-pointer hover:text-gray-200 transition mt-4">
        Se déconnecter
      </button>
    </div>
  )
}

export default Lobby