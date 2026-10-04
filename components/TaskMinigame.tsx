'use client'

import { useMemo, useState } from 'react'

export const TASK_TYPES = [
  'Fix Wires', 'Swipe Card', 'Calibrate Engine', 'Empty Trash',
  'Prime Shields', 'Align Telescope', 'Sort Samples', 'Enter Code',
] as const

export default function TaskMinigame({ task, onComplete, onCancel }: { task: any; onComplete: () => void; onCancel: () => void }) {
  const [step, setStep] = useState(0)
  const [code, setCode] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const sequence = useMemo(() => [2, 4, 1, 3], [])
  const done = () => setTimeout(onComplete, 250)
  const type = task.title
  const tapSequence = (n: number) => {
    if (n !== sequence[step]) return setStep(0)
    if (step === sequence.length - 1) return done()
    setStep(step + 1)
  }
  const toggle = (n: number) => {
    const next = selected.includes(n) ? selected.filter(x => x !== n) : [...selected, n]
    setSelected(next)
    if (next.length === 4) done()
  }

  return <div className="fixed inset-0 z-[1000] bg-slate-950/95 flex items-center justify-center p-5">
    <div className="w-full max-w-sm rounded-3xl border border-emerald-500/40 bg-slate-900 p-6 text-center shadow-2xl space-y-5">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-emerald-400">Assigned task</p>
      <h2 className="text-2xl font-black">{type}</h2>
      {type === 'Swipe Card' && <><p className="text-slate-300">Swipe the card smoothly.</p><button onClick={done} className="w-full rounded-2xl bg-amber-400 py-5 font-black text-slate-950 active:translate-x-2">▐▬▬▬▬▬▬▌</button></>}
      {type === 'Fix Wires' && <><p className="text-slate-300">Tap the colored wires in order.</p><div className="grid grid-cols-4 gap-2">{['bg-red-500','bg-blue-500','bg-amber-400','bg-emerald-500'].map((c, i) => <button key={c} onClick={() => tapSequence(i + 1)} className={`${c} h-14 rounded-xl ${step === i ? 'ring-4 ring-white' : ''}`} />)}</div><p className="text-xs text-slate-400">Progress: {step}/4</p></>}
      {type === 'Calibrate Engine' && <><p className="text-slate-300">Stop the dial in the green zone.</p><button onClick={done} className="h-28 w-28 rounded-full border-8 border-emerald-500 bg-slate-800 font-black animate-pulse">CALIBRATE</button></>}
      {type === 'Empty Trash' && <><p className="text-slate-300">Hold to empty the chute.</p><button onPointerDown={() => setTimeout(done, 900)} className="w-full rounded-2xl bg-slate-700 py-6 font-black">HOLD TO EMPTY</button></>}
      {type === 'Prime Shields' && <><p className="text-slate-300">Activate all four shield nodes.</p><div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(n => <button key={n} onClick={() => toggle(n)} className={`rounded-xl py-5 font-bold ${selected.includes(n) ? 'bg-cyan-400 text-slate-950' : 'bg-slate-700'}`}>NODE {n}</button>)}</div></>}
      {type === 'Align Telescope' && <><p className="text-slate-300">Center the target.</p><button onClick={done} className="mx-auto grid h-36 w-36 place-items-center rounded-full border-4 border-slate-400 text-5xl">✦</button></>}
      {type === 'Sort Samples' && <><p className="text-slate-300">Select the contaminated sample.</p><div className="flex justify-center gap-3">{['🧪','🧫','☣️'].map((x,i) => <button key={x} onClick={() => i === 2 && done()} className="rounded-xl bg-slate-700 p-4 text-3xl">{x}</button>)}</div></>}
      {type === 'Enter Code' && <><p className="text-slate-300">Enter the displayed code: <b className="text-amber-400">0420</b></p><input value={code} onChange={e => setCode(e.target.value)} className="w-full rounded-xl bg-slate-800 p-3 text-center font-mono text-xl" maxLength={4}/><button onClick={() => code === '0420' && done()} className="w-full rounded-xl bg-emerald-600 py-3 font-black">SUBMIT</button></>}
      <button onClick={onCancel} className="text-sm font-bold text-slate-400">Cancel</button>
    </div>
  </div>
}
