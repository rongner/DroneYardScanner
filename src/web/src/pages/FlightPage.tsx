import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Radio, Wifi, WifiOff, Play, Square } from 'lucide-react'
import { api } from '@/api/client'
import { useYard } from '@/contexts/YardContext'
import type { FlightMessage } from '@/api/types'

type FlightState = 'idle' | 'flying' | 'done' | 'error'

function StatusBadge({ state }: { state: FlightState }) {
  const styles: Record<FlightState, string> = {
    idle: 'bg-slate-700 text-slate-400',
    flying: 'bg-emerald-900 text-emerald-300',
    done: 'bg-blue-900 text-blue-300',
    error: 'bg-red-900 text-red-300',
  }
  const labels: Record<FlightState, string> = {
    idle: 'Idle', flying: 'Flying…', done: 'Complete', error: 'Error',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[state]}`}>
      {labels[state]}
    </span>
  )
}

export default function FlightPage() {
  const [searchParams] = useSearchParams()
  const { activeYardId } = useYard()
  const [selectedId, setSelectedId] = useState<number | null>(
    searchParams.get('mission') ? Number(searchParams.get('mission')) : null,
  )
  const [logs, setLogs] = useState<string[]>([])
  const [flightState, setFlightState] = useState<FlightState>('idle')
  const wsRef = useRef<WebSocket | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const { data: missions } = useQuery({
    queryKey: ['missions', activeYardId],
    queryFn: () => api.missions.list(activeYardId),
  })

  const { data: droneStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['drone-status'],
    queryFn: api.drone.status,
    refetchInterval: 3000,
  })

  const connectMutation = useMutation({
    mutationFn: api.drone.connect,
    onSuccess: () => { void refetchStatus() },
  })

  const disconnectMutation = useMutation({
    mutationFn: api.drone.disconnect,
    onSuccess: () => { void refetchStatus() },
  })

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  function startMission() {
    if (!selectedId) return
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/api/drone/fly/${selectedId}`)
    wsRef.current = ws
    setLogs([])
    setFlightState('flying')

    ws.onmessage = e => {
      const msg = JSON.parse(e.data as string) as FlightMessage
      if (msg.message) setLogs(prev => [...prev, msg.message])
      if (msg.type === 'complete') setFlightState('done')
      if (msg.type === 'error') setFlightState('error')
    }
    ws.onerror = () => {
      setLogs(prev => [...prev, 'WebSocket connection error'])
      setFlightState('error')
    }
  }

  function stopFlight() {
    wsRef.current?.close()
    wsRef.current = null
    setFlightState('idle')
    setLogs(prev => [...prev, 'Mission aborted'])
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Fly Mission</h1>

      <div className="bg-slate-900 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Mission</h2>
        <select
          value={selectedId ?? ''}
          onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">— choose a mission —</option>
          {missions?.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.waypoints?.length ?? 0} waypoints · {m.status}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-slate-900 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Drone</h2>
          {droneStatus?.connected ? (
            <span className="flex items-center gap-1.5 text-emerald-400 text-sm">
              <Wifi size={14} /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-500 text-sm">
              <WifiOff size={14} /> Disconnected
            </span>
          )}
        </div>

        {droneStatus?.connected && droneStatus.battery != null && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Battery</span>
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${droneStatus.battery < 20 ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${droneStatus.battery}%` }}
              />
            </div>
            <span className={`text-sm font-medium w-10 text-right ${droneStatus.battery < 20 ? 'text-red-400' : 'text-emerald-400'}`}>
              {droneStatus.battery}%
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => connectMutation.mutate()}
            disabled={droneStatus?.connected || connectMutation.isPending}
            className="flex-1 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm py-2 rounded transition-colors"
          >
            {connectMutation.isPending ? 'Connecting…' : 'Connect'}
          </button>
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={!droneStatus?.connected || disconnectMutation.isPending}
            className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm py-2 rounded transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Control</h2>
          <StatusBadge state={flightState} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={startMission}
            disabled={!selectedId || !droneStatus?.connected || flightState === 'flying'}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium py-2 rounded transition-colors"
          >
            <Play size={14} /> Start Mission
          </button>
          <button
            onClick={stopFlight}
            disabled={flightState !== 'flying'}
            className="flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm px-4 py-2 rounded transition-colors"
          >
            <Square size={14} /> Abort
          </button>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Radio
              size={13}
              className={flightState === 'flying' ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}
            />
            Live Feed
          </h2>
          <div className="bg-slate-950 rounded p-3 h-52 overflow-y-auto font-mono text-xs space-y-1">
            {logs.map((line, i) => (
              <p key={i} className="text-slate-300 leading-relaxed">{line}</p>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}
