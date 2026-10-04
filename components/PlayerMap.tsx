// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { createClient } from '@/utils/supabase/client'

const createIcon = (color: string) =>
  L.divIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })

const selfIcon = createIcon('#38bdf8')      // You
const playerIcon = createIcon('#94a3b8')    // Other players (when visible)
const greenIcon = createIcon('#22c55e')     // Tasks
const redIcon = createIcon('#ef4444')       // Emergency
const blueIcon = createIcon('#3b82f6')      // Monitors

// Helper function to calculate distance in feet between two lat/lng points
function getDistanceInFeet(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8 // Radius of Earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distanceMiles = R * c
  return distanceMiles * 5280 // convert to feet
}

export default function PlayerMap({ player }: { player: any }) {
  const supabase = createClient()
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [emergencies, setEmergencies] = useState<any[]>([])
  const [monitors, setMonitors] = useState<any[]>([])
  const [myAssignedTaskIds, setMyAssignedTaskIds] = useState<string[]>([])
  const [nearMonitor, setNearMonitor] = useState(false)

  // Venue center & locked bounds (~500 meters restriction zone)
  const centerLat = 40.7608
  const centerLng = -111.8910
  const venueBounds = [
    [centerLat - 0.005, centerLng - 0.005], 
    [centerLat + 0.005, centerLng + 0.005]
  ] as [[number, number], [number, number]]

  useEffect(() => {
    // 1. Watch GPS location
    if ('geolocation' in navigator) {
      const watcher = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setCoords({ lat, lng })

          // Update location in Supabase
          await supabase.from('players').update({ lat, lng }).eq('id', player.id)

          // Check proximity to monitors (within 20 feet)
          checkMonitors(lat, lng)
        },
        (error) => console.error(error),
        { enableHighAccuracy: true }
      )
      return () => navigator.geolocation.clearWatch(watcher)
    }
  }, [])

  useEffect(() => {
    fetchGameElements()

    const channel = supabase
      .channel('game-play')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => fetchPlayers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchGameElements())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*')
    if (data) setAllPlayers(data)
  }

  const fetchGameElements = async () => {
    const { data: t } = await supabase.from('tasks').select('*')
    const { data: e } = await supabase.from('emergency_buttons').select('*')
    const { data: m } = await supabase.from('monitors').select('*')

    if (t) {
      setTasks(t)
      // Assign random subset of 5 tasks if not already assigned and player is crewmate
      if (myAssignedTaskIds.length === 0 && player.role !== 'imposter') {
        const shuffled = [...t].sort(() => 0.5 - Math.random())
        const countToAssign = Math.min(5, shuffled.length)
        setMyAssignedTaskIds(shuffled.slice(0, countToAssign).map((item) => item.id))
      }
    }
    if (e) setEmergencies(e)
    if (m) setMonitors(m)
    fetchPlayers()
  }

  const checkMonitors = (lat: number, lng: number) => {
    let isNear = false
    for (const m of monitors) {
      const dist = getDistanceInFeet(lat, lng, m.lat, m.lng)
      if (dist <= 20) {
        isNear = true
        break
      }
    }
    setNearMonitor(isNear)
  }

  const completeTask = async (taskId: string) => {
    await supabase.from('tasks').update({ is_completed: true, completed_by: player.name }).eq('id', taskId)
    setMyAssignedTaskIds(myAssignedTaskIds.filter((id) => id !== taskId))
  }

  const mapCenter = coords ? [coords.lat, coords.lng] : [centerLat, centerLng]

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={`p-4 rounded-2xl border text-xs font-bold flex justify-between items-center shadow-lg backdrop-blur ${nearMonitor ? 'bg-blue-950/80 border-blue-500 text-blue-300' : 'bg-slate-900/80 border-slate-800 text-slate-400'}`}>
        <span>{nearMonitor ? '🔵 MONITOR ACTIVE: Player Radar Unlocked!' : '🔒 Monitor Locked (Get within 20ft of a blue monitor)'}</span>
        <span>Role: <strong className={player.role === 'imposter' ? 'text-red-500 text-sm' : 'text-emerald-400 text-sm'}>{player.role}</strong></span>
      </div>

      {/* Locked, secure, boundary-restricted map */}
      <div className="h-[550px] w-full rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl relative z-0">
        <MapContainer 
          center={mapCenter as any} 
          zoom={18} 
          minZoom={17}
          maxZoom={19}
          maxBounds={venueBounds}
          maxBoundsViscosity={1.0}
          dragging={false}
          touchZoom={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          boxZoom={false}
          keyboard={false}
          zoomControl={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* Render Self */}
          {coords && (
            <Marker position={[coords.lat, coords.lng]} icon={selfIcon}>
              <Popup><b>You ({player.name})</b></Popup>
            </Marker>
          )}

          {/* Render Other Players ONLY IF near monitor */}
          {nearMonitor && allPlayers
            .filter((p) => p.id !== player.id && p.status === 'alive' && p.lat && p.lng)
            .map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={playerIcon}>
                <Popup><b>{p.name}</b></Popup>
              </Marker>
            ))}

          {/* Render Emergency Buttons */}
          {emergencies.map((e) => (
            <Marker key={e.id} position={[e.lat, e.lng]} icon={redIcon}>
              <Popup>
                <div className="text-black">
                  🚨 <b>Emergency Button: {e.title}</b>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Render Monitors */}
          {monitors.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={blueIcon}>
              <Popup>
                <div className="text-black">
                  🔵 <b>Monitor: {m.title}</b> (Within 20ft unlocks radar)
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Render Assigned Active Tasks (Crewmates only) */}
          {player.role !== 'imposter' &&
            tasks
              .filter((t) => myAssignedTaskIds.includes(t.id) && !t.is_completed)
              .map((t) => (
                <Marker key={t.id} position={[t.lat, t.lng]} icon={greenIcon}>
                  <Popup>
                    <div className="text-black">
                      🟢 <b>Task: {t.title}</b>
                      <br />
                      <button
                        onClick={() => completeTask(t.id)}
                        className="mt-2 px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-xs"
                      >
                        Complete Task
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
        </MapContainer>
      </div>
    </div>
  )
}