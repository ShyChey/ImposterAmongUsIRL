// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { createClient } from '@/utils/supabase/client'

function MapInvalidator() {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 100)
    return () => clearTimeout(timer)
  }, [map])
  return null
}

const createIcon = (color: string) =>
  L.divIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })

const selfIcon = createIcon('#38bdf8')
const playerIcon = createIcon('#94a3b8')
const greenIcon = createIcon('#22c55e')
const redIcon = createIcon('#ef4444')
const blueIcon = createIcon('#3b82f6')

function getDistanceInFeet(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c * 5280
}

export default function PlayerMap({ player }: { player: any }) {
  const supabase = createClient()
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [myTasks, setMyTasks] = useState<any[]>([])
  const [emergencies, setEmergencies] = useState<any[]>([])
  const [monitors, setMonitors] = useState<any[]>([])
  const [nearMonitor, setNearMonitor] = useState(false)

  const centerLat = 40.7608
  const centerLng = -111.8910
  const venueBounds = [
    [centerLat - 0.008, centerLng - 0.008], 
    [centerLat + 0.008, centerLng + 0.008]
  ] as [[number, number], [number, number]]

  useEffect(() => {
    if ('geolocation' in navigator) {
      const watcher = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          setCoords({ lat, lng })

          await supabase.from('players').update({ lat, lng }).eq('id', player.id)
          checkMonitors(lat, lng)
        },
        (error) => console.error("GPS Error:", error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
      return () => navigator.geolocation.clearWatch(watcher)
    }
  }, [])

  useEffect(() => {
    fetchGameElements()

    const channel = supabase
      .channel('player-game-play')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => fetchPlayers())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_tasks' }, () => fetchMyTasks())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*')
    if (data) setAllPlayers(data)
  }

  const fetchMyTasks = async () => {
    const { data } = await supabase.from('player_tasks').select('*').eq('player_id', player.id)
    if (data) setMyTasks(data)
  }

  const fetchGameElements = async () => {
    fetchMyTasks()
    const { data: e } = await supabase.from('emergency_buttons').select('*')
    const { data: m } = await supabase.from('monitors').select('*')
    if (e) setEmergencies(e)
    if (m) setMonitors(m)
    fetchPlayers()
  }

  const checkMonitors = (lat: number, lng: number) => {
    let isNear = false
    for (const m of monitors) {
      if (getDistanceInFeet(lat, lng, m.lat, m.lng) <= 20) {
        isNear = true
        break
      }
    }
    setNearMonitor(isNear)
  }

  const completeTask = async (taskId: string) => {
    await supabase.from('player_tasks').update({ is_completed: true }).eq('id', taskId)
    fetchMyTasks()
  }

  const mapCenter = coords ? [coords.lat, coords.lng] : [centerLat, centerLng]

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-4 px-2">
      {/* Status banner */}
      <div className={`p-4 rounded-2xl border text-xs font-bold flex flex-col sm:flex-row justify-between items-center gap-2 shadow-lg backdrop-blur ${nearMonitor ? 'bg-blue-950/80 border-blue-500 text-blue-300' : 'bg-slate-900/80 border-slate-800 text-slate-400'}`}>
        <span>{nearMonitor ? '🔵 MONITOR ACTIVE: Player Radar Unlocked!' : '🔒 Monitor Locked (Get within 20ft of a blue monitor)'}</span>
        <span>Role: <strong className={player.role === 'imposter' ? 'text-red-500 text-sm' : 'text-emerald-400 text-sm'}>{player.role}</strong></span>
      </div>

      {/* Fully responsive map container avoiding mobile horizontal clipping */}
      <div className="h-[600px] w-full rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl relative z-0">
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
          <MapInvalidator />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {coords && (
            <Marker position={[coords.lat, coords.lng]} icon={selfIcon}>
              <Popup><b>You ({player.name})</b></Popup>
            </Marker>
          )}

          {nearMonitor && allPlayers
            .filter((p) => p.id !== player.id && p.status === 'alive' && p.lat && p.lng)
            .map((p) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={playerIcon}>
                <Popup><b>{p.name}</b></Popup>
              </Marker>
            ))}

          {emergencies.map((e) => (
            <Marker key={e.id} position={[e.lat, e.lng]} icon={redIcon}>
              <Popup><div className="text-black">🚨 <b>Emergency: {e.title}</b></div></Popup>
            </Marker>
          ))}

          {monitors.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={blueIcon}>
              <Popup><div className="text-black">🔵 <b>Monitor: {m.title}</b></div></Popup>
            </Marker>
          ))}

          {/* Individual Tasks Assigned Specifically to This Player */}
          {player.role !== 'imposter' &&
            myTasks
              .filter((t) => !t.is_completed)
              .map((t) => (
                <Marker key={t.id} position={[t.lat, t.lng]} icon={greenIcon}>
                  <Popup>
                    <div className="text-black">
                      🟢 <b>Your Task: {t.title}</b>
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