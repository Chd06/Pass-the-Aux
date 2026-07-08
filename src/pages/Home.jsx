import { useAuth } from '../AuthContext'
import { Navigate } from 'react-router-dom'

function Home() {
  const { session, logout } = useAuth()

  // Si pas connecté, redirige vers le login
  if (!session) return <Navigate to="/login" />

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl">Connecté en tant que {session.user.email}</h1>
      <button className="bg-white text-black px-6 py-2 rounded-full font-bold">
        Créer une session
      </button>
      <button onClick={logout} className="text-gray-400 underline">
        Se déconnecter
      </button>
    </div>
  )
}

export default Home