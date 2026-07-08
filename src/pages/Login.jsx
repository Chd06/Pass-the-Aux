import { useAuth } from '../AuthContext'
import { Navigate } from 'react-router-dom'

function Login() {
  const { session, loginWithSpotify } = useAuth()

  // Si déjà connecté, redirige automatiquement vers l'accueil
  if (session) return <Navigate to="/" />

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">Pass the Aux</h1>
      <button
        onClick={loginWithSpotify}
        className="bg-green-500 text-black px-6 py-2 rounded-full font-bold"
      >
        Se connecter avec Spotify
      </button>
    </div>
  )
}

export default Login