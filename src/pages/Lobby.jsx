import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { supabase } from '../supabaseClient'
import { Search, Play, Pause, Copy, Check } from 'lucide-react'

// Nombre maximum de morceaux qu'un joueur peut ajouter
const MAX_MORCEAUX_PAR_JOUEUR = 3

function Lobby() {
  // sessionId vient de l'URL (/session/xxxxx)
  const { sessionId } = useParams()
  const { session } = useAuth()

  // --- États liés à la session et aux joueurs ---
  const [joueurs, setJoueurs] = useState([])
  const [sessionData, setSessionData] = useState(null)
  const [monJoueurId, setMonJoueurId] = useState(null)
  const [loading, setLoading] = useState(true)

  // --- États liés à la recherche/ajout de morceaux ---
  const [recherche, setRecherche] = useState('')
  const [resultats, setResultats] = useState([])
  const [mesMorceaux, setMesMorceaux] = useState([])

  // --- États liés au vote ---
  const [morceauxVote, setMorceauxVote] = useState([])
  const [mesVotes, setMesVotes] = useState({})

  // --- États liés au reveal (résultats finaux) ---
  const [resultatsReveal, setResultatsReveal] = useState([])
  const [scores, setScores] = useState([])

  // --- États liés à la lecture audio des extraits ---
  const [lectureEnCours, setLectureEnCours] = useState(null)
  const audioRef = useRef(null)

  // --- États liés au bouton "copier" (code et lien) ---
  const [codeCopie, setCodeCopie] = useState(false)
  const [lienCopie, setLienCopie] = useState(false)

  // ============================================================
  // Chargement initial : infos de la session, ajout du joueur,
  // liste des joueurs, mes morceaux déjà ajoutés
  // ============================================================
  useEffect(() => {
    async function init() {
      const { data: sessionInfo } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      setSessionData(sessionInfo)

      const spotifyId = session.user.user_metadata.provider_id

      // On tente d'ajouter ce joueur à la session (ignoré si déjà présent,
      // grâce à la contrainte unique en base de données)
      await supabase.from('joueurs').insert({
        session_id: sessionId,
        pseudo: session.user.user_metadata.full_name,
        spotify_id: spotifyId,
        user_id: session.user.id,
        avatar_url: session.user.user_metadata.avatar_url || session.user.user_metadata.picture || null,
      })

      // On récupère l'ID de CE joueur précis (qu'il vienne d'être créé
      // ou qu'il existait déjà)
      const { data: monJoueur } = await supabase
        .from('joueurs')
        .select('id')
        .eq('session_id', sessionId)
        .eq('spotify_id', spotifyId)
        .single()

      setMonJoueurId(monJoueur?.id || null)

      // Liste complète des joueurs de cette session
      const { data: liste } = await supabase
        .from('joueurs')
        .select('*')
        .eq('session_id', sessionId)

      setJoueurs(liste || [])

      // Les morceaux que MOI j'ai déjà ajoutés
      const { data: morceaux } = await supabase
        .from('morceaux')
        .select('*')
        .eq('session_id', sessionId)
        .eq('ajoute_par', monJoueur?.id)

      setMesMorceaux(morceaux || [])
      setLoading(false)
    }

    if (session) init()

    // Abonnement temps réel : un nouveau joueur rejoint
    const channelJoueurs = supabase
      .channel(`joueurs-session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'joueurs', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setJoueurs((prev) => {
            // On évite d'ajouter deux fois le même joueur
            const dejaPresent = prev.some((j) => j.id === payload.new.id)
            if (dejaPresent) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()

    // Abonnement temps réel : la session change de statut
    // (lobby -> collecting -> voting -> reveal)
    const channelSession = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        (payload) => setSessionData(payload.new)
      )
      .subscribe()

    // Nettoyage : on se désabonne quand on quitte la page
    return () => {
      supabase.removeChannel(channelJoueurs)
      supabase.removeChannel(channelSession)
    }
  }, [sessionId, session])

  // ============================================================
  // Quand la session passe en phase "voting" : on charge les
  // morceaux à deviner, dans un ordre mélangé, SANS révéler
  // qui les a ajoutés (colonne "ajoute_par" jamais demandée ici)
  // ============================================================
  useEffect(() => {
    async function chargerMorceauxPourVote() {
      const { data } = await supabase
        .from('morceaux')
        .select('id, titre, artiste, spotify_track_id, pochette_url')
        .eq('session_id', sessionId)

      const melanges = [...(data || [])].sort(() => Math.random() - 0.5)
      setMorceauxVote(melanges)
    }

    if (sessionData?.status === 'voting') {
      chargerMorceauxPourVote()
    }
  }, [sessionData?.status, sessionId])

  // ============================================================
  // Quand la session passe en phase "reveal" : on peut enfin lire
  // qui a ajouté chaque morceau, et on calcule les scores
  // ============================================================
  useEffect(() => {
    async function chargerReveal() {
      const { data: morceaux } = await supabase
        .from('morceaux')
        .select('id, titre, artiste, ajoute_par, pochette_url')
        .eq('session_id', sessionId)

      const { data: votes } = await supabase
        .from('votes')
        .select('*')
        .in('morceau_id', (morceaux || []).map((m) => m.id))

      const detaille = (morceaux || []).map((m) => ({
        ...m,
        votesPourCeMorceau: (votes || []).filter((v) => v.morceau_id === m.id),
      }))
      setResultatsReveal(detaille)

      // Calcul du score : +1 point par bonne devinette
      const scoreParJoueur = {}
      joueurs.forEach((j) => { scoreParJoueur[j.id] = 0 })

      ;(votes || []).forEach((v) => {
        const morceau = (morceaux || []).find((m) => m.id === v.morceau_id)
        if (morceau && v.suppose_auteur_id === morceau.ajoute_par) {
          scoreParJoueur[v.votant_id] = (scoreParJoueur[v.votant_id] || 0) + 1
        }
      })

      const classement = joueurs
        .map((j) => ({ pseudo: j.pseudo, score: scoreParJoueur[j.id] || 0 }))
        .sort((a, b) => b.score - a.score)

      setScores(classement)
    }

    if (sessionData?.status === 'reveal' && joueurs.length > 0) {
      chargerReveal()
    }
  }, [sessionData?.status, sessionId, joueurs])

  // ============================================================
  // Actions qui changent le statut de la session
  // ============================================================
  const demarrerSession = async () => {
    await supabase.from('sessions').update({ status: 'collecting' }).eq('id', sessionId)
  }

  const passerAuVote = async () => {
    await supabase.from('sessions').update({ status: 'voting' }).eq('id', sessionId)
  }

  const passerAuReveal = async () => {
    await supabase.from('sessions').update({ status: 'reveal' }).eq('id', sessionId)
  }

  // ============================================================
  // Recherche de morceaux sur Spotify
  // ============================================================
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

  // ============================================================
  // Ajout d'un morceau à MA liste pour cette session
  // ============================================================
  const ajouterMorceau = async (track) => {
    if (!monJoueurId) return
    if (mesMorceaux.length >= MAX_MORCEAUX_PAR_JOUEUR) return

    const pochette = track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || null

    const { data, error } = await supabase
      .from('morceaux')
      .insert({
        session_id: sessionId,
        ajoute_par: monJoueurId,
        spotify_track_id: track.id,
        titre: track.name,
        artiste: track.artists.map((a) => a.name).join(', '),
        pochette_url: pochette,
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

  // ============================================================
  // Vote : deviner qui a ajouté un morceau donné
  // ============================================================
  const voter = async (morceauId, suspectId) => {
    setMesVotes((prev) => ({ ...prev, [morceauId]: suspectId }))

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

  // ============================================================
  // Lecture / pause d'un extrait audio (30 secondes, via Spotify)
  // ============================================================
  const toggleLecture = (track) => {
    if (!track.preview_url) return

    if (lectureEnCours === track.id) {
      audioRef.current?.pause()
      setLectureEnCours(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
    }

    const audio = new Audio(track.preview_url)
    audio.play()
    audio.onended = () => setLectureEnCours(null)
    audioRef.current = audio
    setLectureEnCours(track.id)
  }

  // ============================================================
  // Copier le code ou le lien de la session dans le presse-papier
  // ============================================================
  const copierCode = () => {
    navigator.clipboard.writeText(sessionData.join_code)
    setCodeCopie(true)
    setTimeout(() => setCodeCopie(false), 2000)
  }

  const copierLien = () => {
    navigator.clipboard.writeText(window.location.href)
    setLienCopie(true)
    setTimeout(() => setLienCopie(false), 2000)
  }

  // ============================================================
  // Affichage pendant le chargement
  // ============================================================
  if (loading || !sessionData) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Chargement...</div>
  }

  const estCreateur = session.user.id === sessionData.created_by
  const limiteAtteinte = mesMorceaux.length >= MAX_MORCEAUX_PAR_JOUEUR
  const pseudoDe = (joueurId) => joueurs.find((j) => j.id === joueurId)?.pseudo || '???'

  // ============================================================
  // Ce qui s'affiche réellement à l'écran (le "return" dont tu
  // parlais : c'est simplement la partie visuelle de la page)
  // ============================================================
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Lobby</h1>
      <p className="text-gray-400 text-sm">Thème : {sessionData.theme}</p>
      <p className="text-gray-400 text-sm">Statut : {sessionData.status}</p>

      {/* Le code + lien à partager, uniquement visible tant qu'on est dans le lobby */}
      {sessionData.status === 'lobby' && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full">
            <span className="font-mono text-lg tracking-widest">{sessionData.join_code}</span>
            <button onClick={copierCode} className="cursor-pointer hover:text-green-400 transition">
              {codeCopie ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <button
            onClick={copierLien}
            className="text-sm text-gray-400 underline cursor-pointer hover:text-gray-200 transition flex items-center gap-1"
          >
            {lienCopie ? <Check size={14} /> : <Copy size={14} />}
            {lienCopie ? 'Lien copié !' : 'Copier le lien'}
          </button>
        </div>
      )}

      {/* Liste des joueurs, sous forme d'avatars ronds */}
      <div className="flex flex-col items-center gap-2 mt-4">
        <h2 className="text-lg">Joueurs présents :</h2>
        <div className="flex flex-wrap justify-center gap-4">
          {joueurs.map((j) => (
            <div key={j.id} className="flex flex-col items-center gap-1 w-16">
              {j.avatar_url ? (
                <img
                  src={j.avatar_url}
                  alt={j.pseudo}
                  className="w-14 h-14 rounded-full object-cover border-2 border-gray-700"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center text-lg font-bold">
                  {j.pseudo?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <span className="text-xs text-gray-300 text-center truncate w-full">{j.pseudo}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bouton "Démarrer", visible uniquement pour le créateur, en phase lobby */}
      {estCreateur && sessionData.status === 'lobby' && (
        <button
          onClick={demarrerSession}
          className="bg-green-500 text-black px-6 py-2 rounded-full font-bold cursor-pointer hover:bg-green-400 transition"
        >
          Démarrer
        </button>
      )}

      {/* Phase "collecting" : recherche et ajout de morceaux */}
      {sessionData.status === 'collecting' && (
        <div className="w-full max-w-md mt-4 flex flex-col gap-3">
          <p className="text-sm text-gray-400 text-center">
            {mesMorceaux.length} / {MAX_MORCEAUX_PAR_JOUEUR} morceaux ajoutés
          </p>

          {limiteAtteinte ? (
            <p className="text-center text-green-400 font-bold">
              Limite atteinte, tu ne peux plus ajouter de morceaux
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
                  className="bg-white text-black px-4 py-2 rounded-full font-bold cursor-pointer hover:bg-gray-200 transition flex items-center justify-center"
                >
                  <Search size={18} />
                </button>
              </form>

              {resultats.map((track) => {
                const pochette = track.album?.images?.[2]?.url || track.album?.images?.[1]?.url
                return (
                  <div key={track.id} className="flex items-center gap-3 bg-gray-800 px-3 py-2 rounded-lg">
                    {pochette ? (
                      <img src={pochette} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-700 flex-shrink-0" />
                    )}

                    <button
                      onClick={() => toggleLecture(track)}
                      disabled={!track.preview_url}
                      className="flex-shrink-0 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center cursor-pointer hover:bg-gray-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      {lectureEnCours === track.id ? <Pause size={14} /> : <Play size={14} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm">{track.name}</p>
                      <p className="truncate text-xs text-gray-400">
                        {track.artists.map((a) => a.name).join(', ')}
                      </p>
                    </div>

                    <button
                      onClick={() => ajouterMorceau(track)}
                      className="flex-shrink-0 bg-green-500 text-black px-3 py-1 rounded-full text-sm font-bold cursor-pointer hover:bg-green-400 transition"
                    >
                      Ajouter
                    </button>
                  </div>
                )
              })}
            </>
          )}

          <div className="mt-4 flex flex-col gap-2">
            <h3 className="text-lg">Mes morceaux ajoutés :</h3>
            {mesMorceaux.map((m) => (
              <div key={m.id} className="flex items-center gap-3 bg-gray-800 px-3 py-2 rounded-lg">
                {m.pochette_url ? (
                  <img src={m.pochette_url} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-700 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm">{m.titre}</p>
                  <p className="truncate text-xs text-gray-400">{m.artiste}</p>
                </div>
              </div>
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

      {/* Phase "voting" : deviner qui a ajouté chaque morceau */}
      {sessionData.status === 'voting' && (
        <div className="w-full max-w-md mt-4 flex flex-col gap-4">
          <h2 className="text-lg text-center">Devine qui a ajouté quoi</h2>

          {morceauxVote.map((m) => (
            <div key={m.id} className="bg-gray-800 px-4 py-3 rounded-lg flex flex-col gap-2">
              <div className="flex items-center gap-3">
                {m.pochette_url ? (
                  <img src={m.pochette_url} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-700" />
                )}
                <span className="text-sm">{m.titre} — {m.artiste}</span>
              </div>
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

          {estCreateur && (
            <button
              onClick={passerAuReveal}
              className="bg-white text-black px-6 py-2 rounded-full font-bold cursor-pointer hover:bg-gray-200 transition mt-4"
            >
              Voir les résultats
            </button>
          )}
        </div>
      )}

      {/* Phase "reveal" : résultats finaux et classement */}
      {sessionData.status === 'reveal' && (
        <div className="w-full max-w-md mt-4 flex flex-col gap-6">
          <div>
            <h2 className="text-lg text-center mb-3">Classement</h2>
            {scores.map((s, i) => (
              <p key={s.pseudo} className="text-center">
                {i + 1}. {s.pseudo} — {s.score} point{s.score > 1 ? 's' : ''}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-lg text-center">Qui a ajouté quoi</h2>
            {resultatsReveal.map((m) => (
              <div key={m.id} className="flex items-center gap-3 bg-gray-800 px-4 py-3 rounded-lg">
                {m.pochette_url ? (
                  <img src={m.pochette_url} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-700" />
                )}
                <div>
                  <p className="text-sm">{m.titre} — {m.artiste}</p>
                  <p className="text-green-400 font-bold text-sm">Ajouté par : {pseudoDe(m.ajoute_par)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="text-gray-400 underline cursor-pointer hover:text-gray-200 transition mt-8">
        Se déconnecter
      </button>
    </div>
  )
}

export default Lobby