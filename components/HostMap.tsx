// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { createClient } from '@/utils/supabase/client'
import { TASK_TYPES } from '@/components/TaskMinigame'

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

const createTaskIcon = (color: string) =>
  L.divIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

const greenIcon = createTaskIcon('#22c55e') // Task Templates
const redIcon = createTaskIcon('#ef4444')   // Emergency Buttons
const blueIcon = createTaskIcon('#3b82f6')  // Monitors

export default function HostMap({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const [markerType, setMarkerType] = useState<'task' | 'emergency' | 'monitor'>('task')
  const [tasks, setTasks] = useState<any[]>([])
  const [emergencies, setEmergencies] = useState<any[]>([])
  const [monitors, setMonitors] = useState<any[]>([])
  const [taskType, setTaskType] = useState<string>(TASK_TYPES[0])

  const centerLat = 40.766188
  const centerLng = -111.866754

  useEffect(() => {
    fetchMarkers()
  }, [])

  const fetchMarkers = async () => {
    const { data: t } = await supabase.from('task_templates').select('*')
    const { data: e } = await supabase.from('emergency_buttons').select('*')
    const { data: m } = await supabase.from('monitors').select('*')
    if (t) setTasks(t)
    if (e) setEmergencies(e)
    if (m) setMonitors(m)
  }

  function MapClickHandler() {
    useMapEvents({
      async click(e) {
        const { lat, lng } = e.latlng
        const title = markerType === 'task' ? taskType : prompt(`Enter name for this ${markerType}:`)
        if (!title) return

        if (markerType === 'task') {
          await supabase.from('task_templates').insert([{ title, lat, lng }])
        } else if (markerType === 'emergency') {
          await supabase.from('emergency_buttons').insert([{ title, lat, lng }])
        } else if (markerType === 'monitor') {
          await supabase.from('monitors').insert([{ title, lat, lng }])
        }
        fetchMarkers()
      },
    })
    return null
  }

  const deleteMarker = async (table: string, id: string) => {
    await supabase.from(table).delete().eq('id', id)
    fetchMarkers()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col p-4">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4 gap-3">
        <div>
          <h2 className="text-lg font-black text-amber-500">📍 HOST MAP SETUP</h2>
          <p className="text-xs text-slate-400">Click anywhere on the map to drop the selected marker type.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <select
            value={markerType}
            onChange={(e: any) => setMarkerType(e.target.value)}
            className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-500"
          >
            <option value="task">🟢 Green Task Template</option>
            <option value="emergency">🔴 Red Emergency Button</option>
            <option value="monitor">🔵 Blue Monitor</option>
          </select>
          {markerType === 'task' && <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white">
            {TASK_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>}
          <button onClick={onClose} className="px-4 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold transition">
            Done / Close
          </button>
        </div>
      </div>

      <div className="flex-1 rounded-3xl overflow-hidden border-2 border-slate-800 relative z-0 shadow-2xl">
        <MapContainer center={[centerLat, centerLng]} zoom={18} style={{ height: '100%', width: '100%' }}>
          <MapInvalidator />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler />

          {tasks.map((t) => (
            <Marker key={t.id} position={[t.lat, t.lng]} icon={greenIcon}>
              <Popup>
                <div className="text-black">
                  <b>Task Template: {t.title}</b>
                  <br />
                  <button onClick={() => deleteMarker('task_templates', t.id)} className="text-red-600 font-bold text-xs mt-1 hover:underline">Delete</button>
                </div>
              </Popup>
            </Marker>
          ))}

          {emergencies.map((e) => (
            <Marker key={e.id} position={[e.lat, e.lng]} icon={redIcon}>
              <Popup>
                <div className="text-black">
                  <b>Emergency: {e.title}</b>
                  <br />
                  <button onClick={() => deleteMarker('emergency_buttons', e.id)} className="text-red-600 font-bold text-xs mt-1 hover:underline">Delete</button>
                </div>
              </Popup>
            </Marker>
          ))}

          {monitors.map((m) => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={blueIcon}>
              <Popup>
                <div className="text-black">
                  <b>Monitor: {m.title}</b>
                  <br />
                  <button onClick={() => deleteMarker('monitors', m.id)} className="text-red-600 font-bold text-xs mt-1 hover:underline">Delete</button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
