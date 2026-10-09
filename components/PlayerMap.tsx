// @ts-nocheck
'use client'
import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { createClient } from '@/utils/supabase/client'
import TaskMinigame from '@/components/TaskMinigame'

function MapInvalidator() { const map = useMap(); useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 100); return () => clearTimeout(t) }, [map]); return null }
function FollowPlayer({ coords }: { coords:any }) { const map=useMap(), followed=useRef(false); useEffect(()=>{if(coords&&!followed.current){map.setView([coords.lat,coords.lng],17,{animate:true});followed.current=true}},[coords, map]); return null }
const icon = (color: string) => L.divIcon({ className: 'custom-icon', html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:2px solid white"></div>`, iconSize:[22,22], iconAnchor:[11,11] })
const selfIcon=icon('#38bdf8'), playerIcon=icon('#94a3b8'), greenIcon=icon('#22c55e'), redIcon=icon('#ef4444'), blueIcon=icon('#3b82f6'), bodyIcon=icon('#7f1d1d')
const distance = (a:number,b:number,c:number,d:number) => { const R=3958.8, x=(c-a)*Math.PI/180, y=(d-b)*Math.PI/180, z=Math.sin(x/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(y/2)**2; return R*2*Math.atan2(Math.sqrt(z),Math.sqrt(1-z))*5280 }

export default function PlayerMap({ player, gameState, onEmergency }: { player:any; gameState:any; onEmergency:(button:any)=>void }) {
  const supabase=createClient(); const [coords,setCoords]=useState<any>(null); const [players,setPlayers]=useState<any[]>([]); const [tasks,setTasks]=useState<any[]>([]); const [emergencies,setEmergencies]=useState<any[]>([]); const [monitors,setMonitors]=useState<any[]>([]); const [activeTask,setActiveTask]=useState<any>(null); const [deathDismissed,setDeathDismissed]=useState(false)
  const center=[40.766188,-111.866754]
  const venueBounds=[[center[0]-.008,center[1]-.008],[center[0]+.008,center[1]+.008]] as any
  const refresh=async()=>{ const [{data:p},{data:t},{data:e},{data:m}]=await Promise.all([supabase.from('players').select('*'),supabase.from('player_tasks').select('*').eq('player_id',player.id),supabase.from('emergency_buttons').select('*'),supabase.from('monitors').select('*')]); setPlayers(p||[]);setTasks(t||[]);setEmergencies(e||[]);setMonitors(m||[]) }
  useEffect(()=>{ refresh(); const channel=supabase.channel(`game-${player.id}`).on('postgres_changes',{event:'*',schema:'public',table:'players'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'player_tasks'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'emergency_buttons'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'monitors'},refresh).subscribe(); return()=>supabase.removeChannel(channel) },[])
  useEffect(()=>{ if(!navigator.geolocation) return; const watcher=navigator.geolocation.watchPosition(async pos=>{const next={lat:pos.coords.latitude,lng:pos.coords.longitude};setCoords(next);await supabase.from('players').update(next).eq('id',player.id)},console.error,{enableHighAccuracy:true,timeout:10000,maximumAge:1000}); return()=>navigator.geolocation.clearWatch(watcher) },[player.id])
  const nearby=(x:any)=>coords && distance(coords.lat,coords.lng,x.lat,x.lng)<=50
  const nearMonitor=monitors.some(nearby), nearEmergency=emergencies.find(nearby), nearbyTask=tasks.find(t=>!t.is_completed&&nearby(t))
  const nearbyVictims=players.filter(p=>p.id!==player.id&&p.status==='alive'&&p.role==='crewmate'&&nearby(p))
  const nearbyBody=players.find(p=>p.id!==player.id&&p.status==='dead'&&p.death_kind==='killed'&&p.lat&&p.lng&&nearby(p))
  const killReady=player.kill_available_at?new Date(player.kill_available_at).getTime()<=Date.now():true
  const finish=async()=>{await supabase.from('player_tasks').update({is_completed:true}).eq('id',activeTask.id);setActiveTask(null);refresh()}
  const kill=async()=>{if(player.role!=='imposter'||!killReady||gameState?.status!=='playing'||!nearbyVictims.length)return;const victim=nearbyVictims[Math.floor(Math.random()*nearbyVictims.length)];const now=new Date();await supabase.from('players').update({status:'dead',death_kind:'killed',killed_at:now.toISOString()}).eq('id',victim.id);await supabase.from('players').update({kill_available_at:new Date(now.getTime()+90000).toISOString()}).eq('id',player.id);refresh()}
  useEffect(()=>{if(player.death_kind==='killed'&&player.killed_at)setDeathDismissed(false)},[player.killed_at])
  const paused=gameState?.status!=='playing' || player.status!=='alive'
  return <div className="space-y-4">
    {activeTask && <TaskMinigame task={activeTask} onComplete={finish} onCancel={()=>setActiveTask(null)}/>} 
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button disabled={!nearbyTask||paused||player.role==='imposter'} onClick={()=>setActiveTask(nearbyTask)} className="rounded-2xl bg-emerald-600 py-4 font-black disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">✓ COMPLETE TASK</button>
      <button disabled={!nearEmergency||paused} onClick={()=>onEmergency(nearEmergency)} className="rounded-2xl bg-red-600 py-4 font-black disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">🚨 CALL EMERGENCY MEETING</button>
      <button disabled={player.role!=='imposter'||!killReady||!nearbyVictims.length||paused} onClick={kill} className="rounded-2xl bg-red-700 py-4 font-black disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">☠ KILL {player.role==='imposter'&&!killReady?'(COOLDOWN)':''}</button>
      <button disabled={!nearbyBody||paused} onClick={()=>onEmergency(nearbyBody)} className="rounded-2xl bg-orange-600 py-4 font-black disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">⚑ REPORT BODY</button>
    </div>
    <div className={`relative overflow-hidden rounded-2xl border p-3 text-center text-xs font-bold ${nearMonitor?'border-cyan-300 bg-slate-950 text-cyan-100':'border-slate-800 bg-slate-900 text-slate-400'}`}>{nearMonitor&&<img src="/among-us/security.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-20"/>}<span className="relative">{nearMonitor?'SECURITY ONLINE — live locations visible':'SECURITY OFFLINE — move within 50 ft of a monitor'}</span></div>
    {player.status !== 'alive' && <div className="rounded-2xl bg-slate-800 p-4 text-center font-bold text-slate-300">{player.death_kind==='killed'?'You were killed.':'You were ejected.'} You can watch, but cannot interact.</div>}
    {player.status==='dead'&&player.death_kind==='killed'&&!deathDismissed&&<div className="fixed inset-0 z-[1500] grid place-items-center bg-red-950/95 p-6 text-center"><div className="max-w-md space-y-6 rounded-3xl border-4 border-red-500 bg-slate-950 p-10 shadow-[0_0_80px_rgba(239,68,68,.7)]"><img src="/among-us/kill-stab.png" alt="" className="mx-auto h-32 w-full object-cover object-top"/><h2 className="text-4xl font-black tracking-widest text-red-500">YOU WERE KILLED</h2><p className="text-slate-300">Your body can be reported. You are now a ghost observer.</p><button onClick={()=>setDeathDismissed(true)} className="rounded-xl border-2 border-red-100 bg-red-600 px-6 py-3 font-black shadow-[0_4px_0_#7f1d1d]">CONTINUE AS GHOST</button></div></div>}
    <div className="aspect-square w-full overflow-hidden rounded-3xl border-2 border-slate-800"><MapContainer center={coords?[coords.lat,coords.lng]:center as any} zoom={17} minZoom={16} maxZoom={19} maxBounds={venueBounds} maxBoundsViscosity={1} style={{height:'100%',width:'100%'}} dragging touchZoom scrollWheelZoom zoomControl={false}><MapInvalidator/><FollowPlayer coords={coords}/><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
      {coords&&<Marker position={[coords.lat,coords.lng]} icon={selfIcon}><Popup>You ({player.name})</Popup></Marker>}
      {nearMonitor&&players.filter(p=>p.id!==player.id&&p.status==='alive'&&p.lat&&p.lng).map(p=><Marker key={p.id} position={[p.lat,p.lng]} icon={playerIcon}><Popup>{p.name}</Popup></Marker>)}
      {players.filter(p=>p.status==='dead'&&p.death_kind==='killed'&&p.lat&&p.lng).map(p=><Marker key={`body-${p.id}`} position={[p.lat,p.lng]} icon={bodyIcon}><Popup>☠ Body of {p.name}</Popup></Marker>)}
      {emergencies.map(e=><Marker key={e.id} position={[e.lat,e.lng]} icon={redIcon}><Popup>🚨 {e.title}</Popup></Marker>)}
      {monitors.map(m=><Marker key={m.id} position={[m.lat,m.lng]} icon={blueIcon}><Popup>🔵 {m.title}</Popup></Marker>)}
      {player.role==='crewmate'&&tasks.filter(t=>!t.is_completed).map(t=><Marker key={t.id} position={[t.lat,t.lng]} icon={greenIcon}><Popup>🟢 Your task: {t.title}</Popup></Marker>)}
    </MapContainer></div>
  </div>
}
