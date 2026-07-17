import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import { useAuth } from './AuthContext'

function App() {
  const { loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Chargement...</div>
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/session/:sessionId" element={<Lobby />} />
    </Routes>
  )
}

export default App