import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Leaf, ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '@/api/client'
import { useYard } from '@/contexts/useYard'
import { ScanPhoto } from '@/components/ScanPhoto'
import { HealthBadge } from '@/components/HealthBadge'
import type { PlantScan, PlantSummary } from '@/api/types'

function HealthTrendIcon({ status }: { status: string | null }) {
  if (!status) return null
  return status.toLowerCase().includes('healthy')
    ? <TrendingUp size={14} className="text-emerald-400" />
    : <TrendingDown size={14} className="text-red-400" />
}

function PlantCard({ summary, onClick }: { summary: PlantSummary; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-slate-900 hover:bg-slate-800 rounded-xl p-4 transition-colors space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Leaf size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <span className="font-semibold text-sm">{summary.label}</span>
        </div>
        <HealthBadge status={summary.latest_health} />
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>{summary.scan_count} scan{summary.scan_count !== 1 ? 's' : ''}</span>
        <span>First: {new Date(summary.first_seen).toLocaleDateString()}</span>
        <span>Last: {new Date(summary.last_seen).toLocaleDateString()}</span>
      </div>
    </button>
  )
}

function ScanHistoryCard({ scan }: { scan: PlantScan }) {
  const healthy = scan.health_status?.toLowerCase().includes('healthy')
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${healthy ? 'bg-emerald-400' : scan.health_status ? 'bg-red-400' : 'bg-slate-600'}`} />
        <div className="w-px flex-1 bg-slate-800 mt-1" />
      </div>
      <div className="pb-6 flex-1">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs text-slate-500">{new Date(scan.scanned_at).toLocaleString()}</p>
          <HealthTrendIcon status={scan.health_status} />
        </div>
        <div className="bg-slate-900 rounded-xl overflow-hidden">
          <ScanPhoto
            src={api.scans.photoUrl(scan.id)}
            className="w-full h-36"
          />
          <div className="p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{scan.plant_name ?? 'Unknown plant'}</p>
              <HealthBadge status={scan.health_status} />
            </div>
            {scan.diseases && (
              <p className="text-xs text-slate-400">{scan.diseases}</p>
            )}
            {scan.probability != null && (
              <p className="text-xs text-slate-600">{(scan.probability * 100).toFixed(0)}% confidence</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PlantHistoryPage() {
  const { activeYardId, yards } = useYard()
  const [selectedPlant, setSelectedPlant] = useState<PlantSummary | null>(null)

  const { data: plants, isLoading: plantsLoading } = useQuery({
    queryKey: ['plants', activeYardId],
    queryFn: () => api.scans.plants(activeYardId!),
    enabled: activeYardId !== null,
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['plant-history', activeYardId, selectedPlant?.label],
    queryFn: () => api.scans.plantHistory(activeYardId!, selectedPlant!.label),
    enabled: activeYardId !== null && selectedPlant !== null,
  })

  if (activeYardId === null) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center py-20">
        <Leaf size={48} className="text-slate-700 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Plant History</h1>
        <p className="text-slate-500 text-sm">
          Select a yard from the nav to view plant health history.
          {yards.length === 0 && ' Create a yard first using the + button.'}
        </p>
      </div>
    )
  }

  if (selectedPlant) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <button
          onClick={() => setSelectedPlant(null)}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-sm transition-colors"
        >
          <ChevronLeft size={16} /> Back to plants
        </button>

        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Leaf size={20} className="text-emerald-400" />
            {selectedPlant.label}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {selectedPlant.scan_count} scan{selectedPlant.scan_count !== 1 ? 's' : ''} · current status:{' '}
            <span className={selectedPlant.latest_health?.includes('healthy') ? 'text-emerald-400' : 'text-red-400'}>
              {selectedPlant.latest_health ?? 'unknown'}
            </span>
          </p>
        </div>

        {historyLoading && <p className="text-slate-500 text-sm">Loading history…</p>}

        {history && history.length === 0 && (
          <p className="text-slate-500 text-sm">No scan history found.</p>
        )}

        {history && history.length > 0 && (
          <div className="pt-2">
            {history.map(scan => <ScanHistoryCard key={scan.id} scan={scan} />)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">Plant History</h1>
      <p className="text-slate-400 text-sm">
        Track the health of each named plant over time across all missions.
      </p>

      {plantsLoading && <p className="text-slate-500 text-sm">Loading plants…</p>}

      {!plantsLoading && plants && plants.length === 0 && (
        <div className="text-center py-16">
          <Leaf size={48} className="text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">
            No labeled plants found. Add labels to your waypoints when planning a mission
            and run a simulation or flight to build history.
          </p>
        </div>
      )}

      {plants && plants.length > 0 && (
        <div className="space-y-2">
          {plants.map(p => (
            <PlantCard key={p.label} summary={p} onClick={() => setSelectedPlant(p)} />
          ))}
        </div>
      )}
    </div>
  )
}
