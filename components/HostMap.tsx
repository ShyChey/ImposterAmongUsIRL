'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import dynamic from 'next/dynamic'

const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false })

export default function HostMap({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const [tasks, setTasks] = useState<any[]>([])
  const [emergencyButtons, setEmergencyButtons] = useState<any[]>([])
  const [pinType, setPinType] = useState<'task' | 'emergency'>('task')
  const [title, setTitle] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)
  
  const centerLat = 40.7608 
  const centerLng = -111.8910

  useEffect(() => {
    fetchPins()
  }, [])

  const fetchPins = async () => {
    const { data: tData } = await supabase.from('tasks').select('*')
    if (tData) setTasks(tData)

    const { data: eData } = await supabase.from('emergency_buttons').select('*')
    if (eData) setEmergencyButtons(eData)
  }

  const handleMapClick = (e: any) => {
    setSelectedLocation({ lat: e.latlng.lat, lng: e.latlng.lng })
  }

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLocation || !title) return

    if (pinType === 'task') {
      await supabase.from('tasks').insert([{ title, lat: selectedLocation.lat, lng: selectedLocation.lng, is_completed: false }])
    } else {
      await supabase.from('emergency_buttons').insert([{ title, lat: selectedLocation.lat, lng: selectedLocation.lng }])
    }

    setTitle('')
    setSelectedLocation(null)
    fetchPins()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col p-4">
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-t-2xl border border-slate-800">
        <h2 className="text-xl font-black text-red-500">📍 HOST MAP SETUP</h2>
        <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg font-bold text-sm">
          Close Map
        </button>
      </div>

      <div className="flex-1 w-full relative z-0">
        {typeof window !== 'undefined' && (
          <MapContainer 
            center={[centerLat, centerLng]} 
            zoom={17} 
            style={{ height: '100%', width: '100%' }}
            onClick={handleMapClick}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {tasks.map((t) => (
              <Marker key={`t-${t.id}`} position={[t.lat, t.lng]}>
                <Popup><strong>Task:</strong> {t.title}</Popup>
              </Marker>
            ))}

            {emergencyButtons.map((e) => (
              <Marker key={`e-${e.id}`} position={[e.lat, e.lng]}>
                <Popup>🚨 <strong>Emergency Button:</strong> {e.title}</Popup>
              </Marker>
            ))}

            {selectedLocation && (
              <Marker position={[selectedLocation.lat, selectedLocation.lng]}>
                <Popup>Selected Pin Location</Popup>
              </Marker>
            )}
          </MapContainer>
        )}
      </div>

      {selectedLocation && (
        <form onSubmit={savePin} className="bg-slate-900 p-4 border-t border-slate-800 flex flex-col sm:flex-row gap-4 items-center">
          <select
            value={pinType}
            onChange={(e) => setPinType(e.target.value as any)}
            className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-white font-bold"
          >
            <option value="task">Regular Task Pin</option>
            <option value="emergency">🚨 Emergency Button Pin</option>
          </select>

          <input
            type="text"
            placeholder={pinType === 'task' ? "Task Name (e.g. Fix Wires)" : "Button Name (e.g. Cafe Emergency)"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white"
            required
          />
          <button type="submit" className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold">
            Save Pin
          </button>
        </form>
      )}
    </div>
  )
}