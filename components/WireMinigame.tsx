'use client'
import { useState } from 'react'

const COLORS = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-purple-500']

export default function WireMinigame({ onComplete }: { onComplete: () => void }) {
  const [connected, setConnected] = useState<number[]>([])

  const handleConnect = (index: number) => {
    if (!connected.includes(index)) {
      const next = [...connected, index]
      setConnected(next)
      if (next.length === COLORS.length) {
        setTimeout(onComplete, 500) // Trigger success after short delay
      }
    }
  }

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-center space-y-6 max-w-sm mx-auto">
      <h3 className="text-xl font-black text-amber-400">FIX WIRES</h3>
      <p className="text-sm text-slate-400">Tap matching wires to connect circuits!</p>

      <div className="flex justify-between gap-4">
        <div className="space-y-3 flex-1">
          {COLORS.map((color, i) => (
            <button
              key={i}
              onClick={() => handleConnect(i)}
              className={`w-full h-12 rounded-lg ${color} ${connected.includes(i) ? 'opacity-40' : 'animate-pulse'}`}
            />
          ))}
        </div>
        <div className="space-y-3 flex-1">
          {COLORS.slice().reverse().map((color, i) => {
            const originalIndex = COLORS.length - 1 - i
            return (
              <button
                key={i}
                onClick={() => handleConnect(originalIndex)}
                className={`w-full h-12 rounded-lg ${color} ${connected.includes(originalIndex) ? 'opacity-40' : 'animate-pulse'}`}
              />
            )
          })}
        </div>
      </div>
      <p className="text-xs text-slate-500">Connected: {connected.length} / {COLORS.length}</p>
    </div>
  )
}