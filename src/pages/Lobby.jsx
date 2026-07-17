import { useParams } from 'react-router-dom'

function Lobby() {
  const { sessionId } = useParams()

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Lobby</h1>
      <p className="text-gray-400">Session ID : {sessionId}</p>
    </div>
  )
}

export default Lobby