'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import HostMap from '@/components/HostMap'
import PlayerMap from '@/components/PlayerMap'

export default function Home() {
  const supabase = createClient()
  const [player, setPlayer] = useState<any>(null)
  const [nameInput, setNameInput] = useState('')
  const [gameState, setGameState] = useState<any>(null)
  const [playersList, setPlayersList] = useState<any[]>([])
  const [showHostMap, setShowHostMap] = useState(false)

  useEffect(() => {
    fetchGameState()

    const channel = supabase
      .channel('lobby-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, (payload) => {
        setGameState(payload.new)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchPlayers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchGameState = async () => {
    let { data } = await supabase.from('game_state').select('*').eq('id', 1).single()
    if (!data) {
      // Initialize game state if it doesn't exist
      const { data: newData } = await supabase.from('game_state').insert([{ id: 1, status: 'lobby' }]).select().single()
      data = newData
    }
    setGameState(data)
    fetchPlayers()
  }

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*')
    if (data) setPlayersList(data)
  }

  const joinGame = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameInput.trim()) return

    // First player to join becomes the host if no host is set
    const isFirstPlayer = playersList.length === 0
    const role = 'crewmate' // Default role until game starts

    const { data, error } = await supabase.from('players').insert([
      { name: nameInput, role, status: 'alive', is_host: isFirstPlayer }
    ]).select().single()

    if (data) {
      setPlayer(data)
    }
  }

  const startGame = async () => {
    // Randomly pick one imposter, make everyone else crewmates
    const updatedPlayers = [...playersList]
    if (updatedPlayers.length === 0) return

    const imposterIndex = Math.floor(Math.random() * updatedPlayers.length)
    
    for (let i = 0; i < updatedPlayers.length; i++) {
      const assignedRole = i === imposterIndex ? 'imposter' : 'crewmate'
      await supabase.from('players').update({ role: assignedRole }).eq('id', updatedPlayers[i].id)
    }

    // Transition game state to playing
    await supabase.from('game_state').update({ status: 'playing' }).eq('id', 1)
  }

  // 1. Login Screen if player hasn't joined yet
  if (!player) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-6">
          <h1 className="text-3xl font-black text-center text-red-500 tracking-wider">IRL AMONG US</h1>
          <form onSubmit={joinGame} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Your Agent Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. RedSus"
                className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:outline-none focus:border-red-500"
                required
              />
            </div>
            <button type="submit" className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-black text-lg tracking-wider shadow-lg transition">
              JOIN LOBBY
            </button>
          </form>
        </div>
      </main>
    )
  }

  // 2. Lobby Waiting Room
  if (gameState?.status === 'lobby') {
    return (
      <main className="flex min-h-screen flex-col items-center p-6 bg-slate-950 text-white">
        <div className="w-full max-w-xl bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6 mt-10">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-amber-500">🎮 GAME LOBBY</h1>
            <p className="text-sm text-slate-400">Waiting for the host to set up the map and start the game...</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Joined Players ({playersList.length})</h2>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto">
              {playersList.map((p) => (
                <div key={p.id} className="flex justify-between items-center text-sm font-semibold">
                  <span>{p.name} {p.is_host && '👑 (Host)'}</span>
                  <span className="text-xs text-slate-500">Ready</span>
                </div>
              ))}
            </div>
          </div>

          {/* Host Controls */}
          {player.is_host && (
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => setShowHostMap(true)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl font-bold tracking-wide"
              >
                📍 Setup Task & Emergency Pins (Host Map)
              </button>

              <button
                onClick={startGame}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-black text-lg tracking-wider shadow-lg"
              >
                🚀 START GAME
              </button>
            </div>
          )}
        </div>

        {showHostMap && <HostMap onClose={() => setShowHostMap(false)} />}
      </main>
    )
  }

  // 3. Active Gameplay Screen
  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-slate-950 text-white">
      <div className="w-full max-w-xl space-y-4">
        <header className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800">
          <div>
            <h1 className="font-black text-lg">{player.name}</h1>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Role: <span className={player.role === 'imposter' ? 'text-red-500 font-bold' : 'text-emerald-400 font-bold'}>{player.role}</span></p>
          </div>
          <div className="px-3 py-1 bg-slate-800 rounded-full text-xs font-bold uppercase">
            Status: {player.status}
          </div>
        </header>

        <PlayerMap player={player} />
      </div>
    </main>
  )
}