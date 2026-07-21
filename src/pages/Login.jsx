import { useAuth } from '../AuthContext'
import { Navigate } from 'react-router-dom'

function Login() {
  const { session, loginWithSpotify } = useAuth()

  if (session) return <Navigate to="/" />

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">Pass the Aux</h1>
      <button
        onClick={loginWithSpotify}
        className="bg-[#1DB954] text-black px-6 py-2 rounded-full font-bold cursor-pointer hover:bg-[#1ed760] transition"
      >
        Se connecter avec Spotify
      </button>
    </div>
  )
}

export default Login