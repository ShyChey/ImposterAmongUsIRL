'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import dynamic from 'next/dynamic'
import WireMinigame from './WireMinigame'

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false })

function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180)
}

export default function PlayerMap({ player }: { player: any }) {
  const supabase = createClient()
  const [tasks, setTasks] = useState<any[]>([])
  const [emergencyButtons, setEmergencyButtons] = useState<any[]>([])
  const [otherPlayers, setOtherPlayers] = useState<any[]>([])
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  
  const [activeTask, setActiveTask] = useState<any | null>(null)
  const [activeMinigameTask, setActiveMinigameTask] = useState<any | null>(null)
  const [killTarget, setKillTarget] = useState<any | null>(null)
  const [deadBodyTarget, setDeadBodyTarget] = useState<any | null>(null)
  const [emergencyTarget, setEmergencyTarget] = useState<any | null>(null)
  const [killCooldown, setKillCooldown] = useState(0)

  const centerLat = 40.7608
  const centerLng = -111.8910

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('game-play-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_buttons' }, () => fetchData())
      .subscribe()

    if (!navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setCurrentLocation({ lat, lng })

        await supabase.from('players').update({ lat, lng }).eq('id', player.id)
      },
      (error) => console.error(error),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )

    const timer = setInterval(() => {
      setKillCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => {
      navigator.geolocation.clearWatch(watchId)
      clearInterval(timer)
      supabase.removeChannel(channel)
    }
  }, [player.id])

  const fetchData = async () => {
    const { data: tData } = await supabase.from('tasks').select('*')
    if (tData) setTasks(tData)

    const { data: eData } = await supabase.from('emergency_buttons').select('*')
    if (eData) setEmergencyButtons(eData)

    const { data: pData } = await supabase.from('players').select('*').neq('id', player.id)
    if (pData) {
      setOtherPlayers(pData)
      if (currentLocation) {
        checkProximity(currentLocation, tData || [], eData || [], pData)
      }
    }
  }

  const checkProximity = (loc: { lat: number; lng: number }, taskList: any[], emergencyList: any[], playerList: any[]) => {
    // 1. Task Proximity (25m)
    let foundTask = null
    for (const t of taskList) {
      if (!t.is_completed && getDistanceFromLatLonInMeters(loc.lat, loc.lng, t.lat, t.lng) <= 25) {
        foundTask = t
        break
      }
    }
    setActiveTask(foundTask)

    // 2. Emergency Button Proximity (15m)
    let foundEmergency = null
    for (const eb of emergencyList) {
      if (getDistanceFromLatLonInMeters(loc.lat, loc.lng, eb.lat, eb.lng) <= 15) {
        foundEmergency = eb
        break
      }
    }
    setEmergencyTarget(foundEmergency)

    // 3. Imposter Kill Target & Dead Body Report Target
    if (player.status === 'alive') {
      let foundVictim = null
      let foundBody = null

      for (const p of playerList) {
        if (p.lat && p.lng) {
          const dist = getDistanceFromLatLonInMeters(loc.lat, loc.lng, p.lat, p.lng)
          
          // Check for live targets if imposter (10m)
          if (player.role === 'imposter' && p.status === 'alive' && dist <= 10) {
            foundVictim = p
          }

          // Check for dead bodies to report (10m)
          if (p.status === 'dead' && dist <= 10) {
            foundBody = p
          }
        }
      }
      setKillTarget(foundVictim)
      setDeadBodyTarget(foundBody)
    }
  }

  const handleTaskComplete = async () => {
    if (!activeMinigameTask) return
    await supabase.from('tasks').update({ is_completed: true, completed_by: player.name }).eq('id', activeMinigameTask.id)
    setActiveMinigameTask(null)
    setActiveTask(null)
    fetchData()
  }

  const executeKill = async () => {
    if (!killTarget || killCooldown > 0) return
    await supabase.from('players').update({ status: 'dead' }).eq('id', killTarget.id)
    setKillTarget(null)
    setKillCooldown(30)
    alert(`You eliminated ${killTarget.name}!`)
  }

  const callMeeting = async (sourceName: string) => {
    const meetingEndTime = new Date(Date.now() + 60000).toISOString() // 60-second voting timer
    await supabase.from('game_state').update({
      status: 'meeting',
      meeting_called_by: sourceName,
      meeting_ends_at: meetingEndTime
    }).eq('id', 1)
  }

  return (
    <div className="w-full space-y-4">
      {activeMinigameTask && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
          <div className="w-full max-w-sm space-y-4">
            <h2 className="text-center font-bold text-lg text-white">{activeMinigameTask.title}</h2>
            <WireMinigame onComplete={handleTaskComplete} />
            <button onClick={() => setActiveMinigameTask(null)} className="w-full py-2 bg-slate-800 rounded-lg text-sm text-slate-300">Cancel</button>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="w-full h-64 rounded-2xl overflow-hidden border border-slate-800 relative z-0">
        {typeof window !== 'undefined' && (
          <MapContainer center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [centerLat, centerLng]} zoom={17} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {currentLocation && <Marker position={[currentLocation.lat, currentLocation.lng]}><Popup>You ({player.name})</Popup></Marker>}
            {tasks.map((t) => <Marker key={t.id} position={[t.lat, t.lng]}><Popup>{t.title} - {t.is_completed ? '✅ Done' : '❌ Pending'}</Popup></Marker>)}
            {emergencyButtons.map((eb) => <Marker key={eb.id} position={[eb.lat, eb.lng]}><Popup>🚨 Emergency Button: {eb.title}</Popup></Marker>)}
          </MapContainer>
        )}
      </div>

      {/* Report Dead Body Button */}
      {deadBodyTarget && (
        <button onClick={() => callMeeting(`Dead Body (${deadBodyTarget.name})`)} className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 font-black text-xl tracking-wider shadow-lg border-2 border-purple-400 animate-pulse">
          🔍 REPORT DEAD BODY ({deadBodyTarget.name.toUpperCase()})!
        </button>
      )}

      {/* Emergency Button Trigger */}
      {emergencyTarget && (
        <button onClick={() => callMeeting(`Emergency Button (${emergencyTarget.title})`)} className="w-full py-4 rounded-xl bg-amber-600 hover:bg-amber-500 font-black text-xl tracking-wider shadow-lg border-2 border-amber-400 animate-pulse">
          🚨 PRESS EMERGENCY BUTTON!
        </button>
      )}

      {/* Imposter Kill Button */}
      {player.role === 'imposter' && player.status === 'alive' && (
        <div>
          {killTarget ? (
            <button onClick={executeKill} disabled={killCooldown > 0} className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xl tracking-wider shadow-lg border-2 border-red-400 animate-pulse">
              🔪 KILL {killTarget.name.toUpperCase()}! {killCooldown > 0 ? `(${killCooldown}s)` : ''}
            </button>
          ) : (
            <div className="text-center p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-400 text-xs font-semibold uppercase">
              Imposter Mode: Get within 10m to kill
            </div>
          )}
        </div>
      )}

      {/* Task Banner */}
      {player.status === 'alive' && !deadBodyTarget && !emergencyTarget && (
        <>
          {activeTask ? (
            <button onClick={() => setActiveMinigameTask(activeTask)} className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-lg tracking-wide shadow-lg animate-bounce">
              ⚡ OPEN TASK: {activeTask.title}
            </button>
          ) : (
            <div className="text-center p-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-sm">
              Walk to task pins or emergency buttons around the block.
            </div>
          )}
        </>
      )}
    </div>
  )
}