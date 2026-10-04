'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import HostMap from '@/components/HostMap'
import PlayerMap from '@/components/PlayerMap'

export default function GamePage() {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState('Red')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerData, setPlayerData] = useState<any>(null)
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [gameState, setGameState] = useState<any>({ status: 'lobby' })
  const [imposterCount, setImposterCount] = useState(1)
  const [showHostMap, setShowHostMap] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)

  const colors = ['Red', 'Blue', 'Green', 'Yellow', 'Pink', 'Orange', 'Purple', 'Cyan']

  useEffect(() => {
    const savedId = localStorage.getItem('among_us_player_id')
    if (savedId) {
      setPlayerId(savedId)
      fetchPlayer(savedId)
    }

    fetchAllPlayers()

    const channel = supabase
      .channel('game-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' }, (payload) => {
        setGameState(payload.new)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
        fetchAllPlayers()
        if (savedId) fetchPlayer(savedId)
      })
      .subscribe()

    supabase.from('game_state').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setGameState(data)
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [playerId])

  // Meeting Timer & Auto-Tally Check
  useEffect(() => {
    if (gameState.status === 'meeting' && gameState.meeting_ends_at) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((new Date(gameState.meeting_ends_at).getTime() - Date.now()) / 1000))
        setTimeLeft(remaining)

        // If time runs out, host or any client triggers tally
        if (remaining === 0 && isHost) {
          tallyVotesAndEject()
        }
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [gameState])

  const fetchPlayer = async (id: string) => {
    const { data } = await supabase.from('players').select('*').eq('id', id).single()
    if (data) setPlayerData(data)
  }

  const fetchAllPlayers = async () => {
    const { data } = await supabase.from('players').select('*').order('created_at', { ascending: true })
    if (data) setAllPlayers(data)
  }

  const joinGame = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const { data, error } = await supabase
      .from('players')
      .insert([{ name, color, role: 'crewmate', status: 'alive', has_voted: false, voted_for: null }])
      .select()
      .single()

    if (error) {
      alert('Error joining game: ' + error.message)
      return
    }

    if (data) {
      localStorage.setItem('among_us_player_id', data.id)
      setPlayerId(data.id)
      setPlayerData(data)
      fetchAllPlayers()
    }
  }

  const isHost = allPlayers.length > 0 && allPlayers[0].id === playerId

  const startGame = async () => {
    if (allPlayers.length === 0) return
    const shuffled = [...allPlayers].sort(() => 0.5 - Math.random())

    for (let i = 0; i < shuffled.length; i++) {
      const newRole = i < imposterCount ? 'imposter' : 'crewmate'
      await supabase
        .from('players')
        .update({ role: newRole, status: 'alive', has_voted: false, voted_for: null })
        .eq('id', shuffled[i].id)
    }

    await supabase
      .from('game_state')
      .update({ status: 'playing', meeting_called_by: null, last_ejected_name: null, winner: null })
      .eq('id', 1)
  }

  const castVote = async (targetPlayerId: string | null) => {
    await supabase
      .from('players')
      .update({ voted_for: targetPlayerId, has_voted: true })
      .eq('id', playerData.id)
    
    fetchPlayer(playerData.id)
    fetchAllPlayers()
  }

  const tallyVotesAndEject = async () => {
    // Count votes
    const voteCounts: Record<string, number> = {}
    let skipCount = 0

    allPlayers.forEach((p) => {
      if (p.voted_for === 'skip') {
        skipCount++
      } else if (p.voted_for) {
        voteCounts[p.voted_for] = (voteCounts[p.voted_for] || 0) + 1
      }
    })

    let maxVotes = 0
    let ejectedPlayerId: string | null = null

    for (const [id, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count
        ejectedPlayerId = id
      }
    }

    let ejectedName = 'No One (Skipped)'
    let ejectedWasImposter = false

    if (ejectedPlayerId) {
      const target = allPlayers.find((p) => p.id === ejectedPlayerId)
      if (target) {
        ejectedName = target.name
        ejectedWasImposter = target.role === 'imposter'
        // Kill the player
        await supabase.from('players').update({ status: 'dead' }).eq('id', target.id)
      }
    }

    // Check win conditions
    const remainingPlayers = allPlayers.map(p => p.id === ejectedPlayerId ? { ...p, status: 'dead' } : p)
    const aliveImposters = remainingPlayers.filter(p => p.role === 'imposter' && p.status === 'alive').length
    const aliveCrewmates = remainingPlayers.filter(p => p.role === 'crewmate' && p.status === 'alive').length

    let winner = null
    if (aliveImposters === 0) winner = 'crewmates'
    else if (aliveImposters >= aliveCrewmates) winner = 'imposters'

    // Reset votes and resume game or announce winner
    for (const p of allPlayers) {
      await supabase.from('players').update({ has_voted: false, voted_for: null }).eq('id', p.id)
    }

    await supabase.from('game_state').update({
      status: winner ? 'ended' : 'playing',
      last_ejected_name: ejectedName,
      last_ejected_was_imposter: ejectedWasImposter,
      winner: winner,
      meeting_called_by: null
    }).eq('id', 1)
  }

  const resetGame = async () => {
    await supabase.from('game_state').update({ status: 'lobby', meeting_called_by: null, winner: null }).eq('id', 1)
  }

  // 1. NOT JOINED YET
  if (!playerId || !playerData) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white">
        <div className="w-full max-w-md bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl">
          <h1 className="text-3xl font-black text-center mb-6 tracking-wider text-red-500">IRL AMONG US</h1>
          <form onSubmit={joinGame} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-400">Your Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name..." className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-400">Choose Your Color</label>
              <select value={color} onChange={(e) => setColor(e.target.value)} className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white">
                {colors.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="submit" className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 font-bold">JOIN LOBBY</button>
          </form>
        </div>
      </main>
    )
  }

  // 2. EMERGENCY MEETING / VOTING ACTIVE
  if (gameState.status === 'meeting') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-red-950 text-white text-center">
        <div className="bg-red-900 p-8 rounded-2xl border-4 border-red-500 max-w-lg w-full shadow-2xl space-y-6">
          <h1 className="text-3xl font-black tracking-wider animate-pulse">EMERGENCY MEETING!</h1>
          <p className="text-sm">Triggered by: <strong>{gameState.meeting_called_by}</strong></p>
          <div className="bg-red-950 p-3 rounded-xl border border-red-800 font-mono text-xl">
            Voting Timer: <strong>{timeLeft}s</strong>
          </div>
          
          <a href="https://discord.gg/your-invite-link" target="_blank" rel="noopener noreferrer" className="block w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold shadow-lg">
            OPEN DISCORD CALL TO DISCUSS
          </a>

          <div className="space-y-2 text-left">
            <h3 className="font-bold text-sm text-red-200">Cast Your Vote:</h3>
            {playerData.has_voted ? (
              <div className="p-3 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-lg text-center font-bold">
                ✅ Vote Cast Successfully! Waiting for others...
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allPlayers.filter(p => p.status === 'alive').map((p) => (
                  <button key={p.id} onClick={() => castVote(p.id)} className="w-full p-3 rounded-lg bg-slate-800 hover:bg-slate-700 flex justify-between font-semibold">
                    <span>{p.name} ({p.color})</span>
                    <span className="text-red-400 text-xs">VOTE</span>
                  </button>
                ))}
                <button onClick={() => castVote('skip')} className="w-full p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-center">
                  SKIP VOTE
                </button>
              </div>
            )}
          </div>

          {isHost && (
            <button onClick={tallyVotesAndEject} className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold">
              END VOTING & TALLY (Host Control)
            </button>
          )}
        </div>
      </main>
    )
  }

  // 3. GAME OVER ENDED STATE
  if (gameState.status === 'ended') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-950 text-white text-center">
        <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 max-w-md w-full space-y-6">
          <h1 className="text-4xl font-black text-amber-400 uppercase tracking-wider">
            {gameState.winner === 'crewmates' ? '🎉 CREWMATES WIN!' : '🔪 IMPOSTERS WIN!'}
          </h1>
          <p className="text-slate-300">Last Ejected: <strong>{gameState.last_ejected_name}</strong> ({gameState.last_ejected_was_imposter ? 'Was an Imposter' : 'Was not an Imposter'})</p>

          {isHost && (
            <button onClick={resetGame} className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold">
              PLAY AGAIN (Back to Lobby)
            </button>
          )}
        </div>
      </main>
    )
  }

  // 4. MAIN LOBBY & GAMEPLAY
  return (
    <main className="flex min-h-screen flex-col items-center p-6 bg-slate-950 text-white">
      <div className="w-full max-w-md space-y-6 my-auto">
        
        {showHostMap && <HostMap onClose={() => setShowHostMap(false)} />}

        {/* Ejection Announcement Banner */}
        {gameState.last_ejected_name && (
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-center text-sm">
            Last Meeting Result: <strong>{gameState.last_ejected_name}</strong> was ejected. 
            <span className={gameState.last_ejected_was_imposter ? 'text-red-500 block font-bold' : 'text-slate-400 block'}>
              {gameState.last_ejected_was_imposter ? 'An Imposter was among us.' : 'They were not an Imposter.'}
            </span>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-center shadow-lg">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Logged in as</p>
          <h2 className="text-2xl font-black text-white">{playerData.name}</h2>
          <p className="text-sm text-slate-400">Color: <span className="font-semibold text-white">{playerData.color}</span></p>
          {isHost && <span className="inline-block mt-2 bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full">👑 HOST</span>}
        </div>

        {/* LOBBY STATE */}
        {gameState.status === 'lobby' && (
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="font-bold text-lg">Players in Lobby ({allPlayers.length})</h3>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {allPlayers.map((p, index) => (
                <li key={p.id} className="text-sm bg-slate-800 p-2 rounded flex justify-between">
                  <span>{index === 0 ? '👑 ' : ''}{p.name} ({p.color})</span>
                </li>
              ))}
            </ul>

            {isHost && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <button onClick={() => setShowHostMap(true)} className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-bold">
                  🗺️ SETUP MAP & EMERGENCY BUTTONS
                </button>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Number of Imposters</label>
                  <input type="number" min="1" max="4" value={imposterCount} onChange={(e) => setImposterCount(Number(e.target.value))} className="w-full p-2 rounded bg-slate-800 border border-slate-700 text-center font-bold" />
                </div>
                <button onClick={startGame} className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold">START GAME</button>
              </div>
            )}
          </div>
        )}

        {/* PLAYING STATE */}
        {gameState.status === 'playing' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-center">
              <p className="text-sm text-slate-400 uppercase tracking-widest">Your Assigned Role</p>
              <h1 className={`text-4xl font-black mt-2 uppercase tracking-wide ${playerData.role === 'imposter' ? 'text-red-500' : 'text-emerald-400'}`}>
                {playerData.role}
              </h1>
              <p className="mt-4 text-slate-300 text-sm">
                Status: <span className={`font-bold uppercase ${playerData.status === 'dead' ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                  {playerData.status === 'dead' ? '👻 DEAD (GHOST)' : playerData.status}
                </span>
              </p>
            </div>

            {playerData.status === 'alive' ? (
              <PlayerMap player={playerData} />
            ) : (
              <div className="bg-red-950/60 p-6 rounded-2xl border border-red-900 text-center space-y-2">
                <h3 className="text-xl font-bold text-red-400">You have been eliminated!</h3>
                <p className="text-xs text-slate-300">You are a ghost. You can still report bodies or trigger emergency meetings if you walk up to them!</p>
              </div>
            )}

            {isHost && (
              <div className="pt-4 flex justify-end">
                <button onClick={resetGame} className="px-4 py-2 rounded-lg bg-red-950 text-red-400 text-xs font-semibold">Reset Game</button>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  )
}