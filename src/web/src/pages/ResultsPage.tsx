import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { useYard } from '@/contexts/useYard'
import { ScanPhoto } from '@/components/ScanPhoto'
import type { PlantScan } from '@/api/types'

function HealthBadge({ status }: { status: string | null }) {
  if (!status) return null
  const healthy = status.toLowerCase().includes('healthy')
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${healthy ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
      {status}
    </span>
  )
}

function StatCard({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-slate-900 rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function ScanCard({ scan }: { scan: PlantScan }) {
  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden flex flex-col">
      <div className="relative">
        <ScanPhoto
          src={api.scans.photoUrl(scan.id)}
          alt={scan.plant_name ?? 'Plant'}
          className="w-full h-40"
        />
        <span className="absolute top-2 right-2 bg-slate-900/80 text-slate-400 text-xs px-1.5 py-0.5 rounded">
          {scan.waypoint.label ?? `#${scan.waypoint.sequence + 1}`}
        </span>
      </div>
      <div className="p-3 space-y-2 flex-1">
        <p className="font-medium text-sm leading-tight">{scan.plant_name ?? 'Unknown plant'}</p>
        <HealthBadge status={scan.health_status} />
        {scan.diseases && (
          <p className="text-xs text-slate-400">{scan.diseases}</p>
        )}
        {scan.probability != null && (
          <p className="text-xs text-slate-600 pt-1">{(scan.probability * 100).toFixed(0)}% confidence</p>
        )}
      </div>
    </div>
  )
}

export default function ResultsPage() {
  const { activeYardId } = useYard()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: missions } = useQuery({
    queryKey: ['missions', activeYardId],
    queryFn: () => api.missions.list(activeYardId),
  })

  const { data: scans, isLoading } = useQuery({
    queryKey: ['scans', selectedId],
    queryFn: () => api.scans.forMission(selectedId!),
    enabled: selectedId !== null,
  })

  const total = scans?.length ?? 0
  const healthy = scans?.filter(s => s.health_status?.toLowerCase().includes('healthy')).length ?? 0

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Results</h1>

      <div className="bg-slate-900 rounded-xl p-4">
        <select
          value={selectedId ?? ''}
          onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">— select a mission —</option>
          {missions?.map(m => (
            <option key={m.id} value={m.id}>{m.name} · {m.status}</option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-slate-500 text-center py-16">Loading…</p>}

      {!isLoading && selectedId !== null && scans && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Scans" value={total} />
            <StatCard label="Healthy" value={healthy} accent />
            <StatCard label="Unhealthy" value={total - healthy} />
            <StatCard label="Health Rate" value={total > 0 ? `${Math.round((healthy / total) * 100)}%` : '—'} />
          </div>

          {total === 0 ? (
            <p className="text-slate-500 text-center py-16">No scans yet for this mission.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {scans.map(scan => <ScanCard key={scan.id} scan={scan} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
