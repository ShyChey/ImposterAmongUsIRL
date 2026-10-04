'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import dynamic from 'next/dynamic'

const HostMap = dynamic(() => import('@/components/HostMap'), { ssr: false })
const PlayerMap = dynamic(() => import('@/components/PlayerMap'), { ssr: false })

export default function Home() {
  const supabase = createClient()
  const [player, setPlayer] = useState<any>(null)
  const [nameInput, setNameInput] = useState('')
  const [gameState, setGameState] = useState<any>(null)
  const [playersList, setPlayersList] = useState<any[]>([])
  const [showHostMap, setShowHostMap] = useState(false)
  const [imposterCount, setImposterCount] = useState(1)

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

  // Whenever the game state shifts to playing, re-fetch the current player's data to get their assigned role!
  useEffect(() => {
    if (gameState?.status === 'playing' && player) {
      const refreshMyRole = async () => {
        const { data } = await supabase.from('players').select('*').eq('id', player.id).single()
        if (data) {
          setPlayer(data)
        }
      }
      refreshMyRole()
    }
  }, [gameState?.status])

  const fetchGameState = async () => {
    let { data } = await supabase.from('game_state').select('*').eq('id', 1).single()
    if (!data) {
      const { data: newData } = await supabase.from('game_state').insert([{ id: 1, status: 'lobby' }]).select().single()
      data = newData
    }
    setGameState(data)
    fetchPlayers()
  }

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*')
    if (data) {
      setPlayersList(data)
      // If player is logged in, update their local reference too
      if (player) {
        const me = data.find((p) => p.id === player.id)
        if (me) setPlayer(me)
      }
    }
  }

  const joinGame = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nameInput.trim()) return

    const isFirstPlayer = playersList.length === 0

    const { data, error } = await supabase.from('players').insert([
      { name: nameInput, role: null, status: 'alive', is_host: isFirstPlayer }
    ]).select().single()

    if (data) {
      setPlayer(data)
    }
  }

  const resetDatabase = async () => {
    if (!confirm("Are you sure you want to wipe all players and reset the entire game?")) return
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('player_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('game_state').update({ status: 'lobby' }).eq('id', 1)
    setPlayer(null)
  }

  const startGame = async () => {
    const { data: currentPlayers } = await supabase.from('players').select('*')
    if (!currentPlayers || currentPlayers.length === 0) return

    const { data: templates } = await supabase.from('task_templates').select('*')
    
    // 1. Shuffle players & assign roles in memory first
    const shuffled = [...currentPlayers].sort(() => 0.5 - Math.random())
    const count = Math.min(imposterCount, Math.max(1, shuffled.length - 1))

    // Prepare all task inserts and player role updates to run concurrently
    const playerUpdatePromises = shuffled.map(async (p, i) => {
      const assignedRole = i < count ? 'imposter' : 'crewmate'

      // Update player role
      await supabase.from('players').update({ role: assignedRole }).eq('id', p.id)

      // If crewmate, batch-insert all tasks at once instead of one by one
      if (assignedRole === 'crewmate' && templates && templates.length > 0) {
        const shuffledTemplates = [...templates].sort(() => 0.5 - Math.random())
        const assignedSubset = shuffledTemplates.slice(0, Math.min(5, shuffledTemplates.length))

        const taskRows = assignedSubset.map((t) => ({
          player_id: p.id,
          title: t.title,
          lat: t.lat,
          lng: t.lng,
          is_completed: false,
        }))

        if (taskRows.length > 0) {
          await supabase.from('player_tasks').insert(taskRows)
        }
      }
    })

    // Execute all player initializations simultaneously
    await Promise.all(playerUpdatePromises)

    // Finally, flip game state to playing all at once
    await supabase.from('game_state').update({ status: 'playing' }).eq('id', 1)
  }

  const restartGame = async () => {
    await supabase.from('player_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('players').update({ role: null, status: 'alive' }).neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('game_state').update({ status: 'lobby' }).eq('id', 1)
  }

  // 1. Login Screen
  if (!player) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl space-y-6">
          <h1 className="text-3xl font-black text-center text-red-500 tracking-wider">IRL AMONG US</h1>
          <form onSubmit={joinGame} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Your Agent Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. RedSus"
                className="w-full p-4 rounded-2xl bg-slate-800 border border-slate-700 text-white font-bold focus:outline-none focus:border-red-500"
                required
              />
            </div>
            <button type="submit" className="w-full py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-black text-lg tracking-wider shadow-lg transition">
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
        <div className="w-full max-w-xl bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6 mt-10 shadow-2xl">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-black text-amber-500">🎮 GAME LOBBY</h1>
            <p className="text-sm text-slate-400">Waiting for the host to start the game...</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Joined Players ({playersList.length})</h2>
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 max-h-48 overflow-y-auto">
              {playersList.map((p) => (
                <div key={p.id} className="flex justify-between items-center text-sm font-semibold">
                  <span>{p.name} {p.is_host && '👑 (Host)'}</span>
                  <span className="text-xs text-emerald-400">Ready</span>
                </div>
              ))}
            </div>
          </div>

          {/* Host Controls */}
          {player.is_host ? (
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Number of Imposters</label>
                <select
                  value={imposterCount}
                  onChange={(e) => setImposterCount(Number(e.target.value))}
                  className="w-full p-3.5 rounded-2xl bg-slate-800 border border-slate-700 text-white font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value={1}>1 Imposter</option>
                  <option value={2}>2 Imposters</option>
                  <option value={3}>3 Imposters</option>
                </select>
              </div>

              <button
                onClick={() => setShowHostMap(true)}
                className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl font-bold tracking-wide transition"
              >
                📍 Setup Task Templates & Zones (Host Map)
              </button>

              <button
                onClick={startGame}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black text-lg tracking-wider shadow-lg transition"
              >
                🚀 START GAME
              </button>

              <button
                onClick={resetDatabase}
                className="w-full py-3 bg-red-950/50 hover:bg-red-900 border border-red-800 rounded-2xl font-bold text-xs uppercase tracking-wider transition text-red-200"
              >
                🔥 WIPE & RESET DATABASE
              </button>
            </div>
          ) : (
            <div className="text-center p-4 bg-slate-950 rounded-2xl border border-slate-800 text-sm text-slate-400">
              Waiting for host to configure settings and launch the match...
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
        <header className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
          <div>
            <h1 className="font-black text-lg">{player.name}</h1>
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Role: <span className={player.role === 'imposter' ? 'text-red-500 font-black text-sm' : 'text-emerald-400 font-black text-sm'}>{player.role || 'Unassigned'}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-slate-800 rounded-full text-xs font-bold uppercase">
              {player.status}
            </div>
            {player.is_host && (
              <button
                onClick={restartGame}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow"
              >
                🔄 Restart
              </button>
            )}
          </div>
        </header>

        <PlayerMap player={player} />
      </div>
    </main>
  )
}