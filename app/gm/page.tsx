'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function GMDashboard() {
  const supabase = createClient()
  const [players, setPlayers] = useState<any[]>([])
  const [gameState, setGameState] = useState<any>({ status: 'lobby' })
  const [imposterCount, setImposterCount] = useState(1)

  useEffect(() => {
    fetchData()

    // Realtime listeners for players joining and game state changes
    const channel = supabase
      .channel('gm-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, (payload) => {
        setGameState(payload.new)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchData = async () => {
    const { data: pData } = await supabase.from('players').select('*')
    if (pData) setPlayers(pData)

    const { data: gData } = await supabase.from('game_state').select('*').eq('id', 1).single()
    if (gData) setGameState(gData)
  }

  // Randomly assign roles and start game
  const startGame = async () => {
    if (players.length === 0) {
      alert('No players have joined yet!')
      return
    }

    // Shuffle players array
    const shuffled = [...players].sort(() => 0.5 - Math.random())

    // Assign imposters
    for (let i = 0; i < shuffled.length; i++) {
      const newRole = i < imposterCount ? 'imposter' : 'crewmate'
      await supabase
        .from('players')
        .update({ role: newRole, status: 'alive' })
        .eq('id', shuffled[i].id)
    }

    // Update global state to playing
    await supabase
      .from('game_state')
      .update({ status: 'playing', meeting_called_by: null })
      .eq('id', 1)
  }

  const endMeeting = async () => {
    await supabase
      .from('game_state')
      .update({ status: 'playing', meeting_called_by: null })
      .eq('id', 1)
  }

  const resetGame = async () => {
    await supabase
      .from('game_state')
      .update({ status: 'lobby', meeting_called_by: null })
      .eq('id', 1)
  }

  return (
    <main className="flex min-h-screen flex-col p-6 bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        <header className="flex justify-between items-center border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-black text-red-500 tracking-wider">GM DASHBOARD</h1>
          <div className="bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 text-sm">
            Status: <span className="font-bold uppercase text-emerald-400">{gameState.status}</span>
          </div>
        </header>

        {/* Controls Section */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-lg font-bold">Game Controls</h2>
          
          {gameState.status === 'lobby' && (
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Number of Imposters</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={imposterCount}
                  onChange={(e) => setImposterCount(Number(e.target.value))}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 w-24 text-center font-bold"
                />
              </div>
              <button
                onClick={startGame}
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold tracking-wide transition-colors"
              >
                START GAME & ASSIGN ROLES
              </button>
            </div>
          )}

          {gameState.status === 'meeting' && (
            <button
              onClick={endMeeting}
              className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-500 font-bold tracking-wide transition-colors"
            >
              RESUME GAME (END MEETING)
            </button>
          )}

          <div className="pt-2 border-t border-slate-800 flex justify-end">
            <button
              onClick={resetGame}
              className="px-4 py-2 rounded-lg bg-red-950 text-red-400 hover:bg-red-900 text-sm font-semibold transition-colors"
            >
              Reset Lobby
            </button>
          </div>
        </div>

        {/* Players List */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <h2 className="text-lg font-bold mb-4">Connected Players ({players.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {players.map((p) => (
              <div key={p.id} className="bg-slate-800 p-3 rounded-xl flex justify-between items-center border border-slate-700">
                <div>
                  <p className="font-bold">{p.name}</p>
                  <p className="text-xs text-slate-400">Color: {p.color}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${p.role === 'imposter' ? 'bg-red-950 text-red-400' : 'bg-slate-700 text-slate-300'}`}>
                    {p.role}
                  </span>
                </div>
              </div>
            ))}
            {players.length === 0 && (
              <p className="text-slate-500 italic col-span-2">No players joined yet. Share your local IP link with friends to test!</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}