import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileDown } from 'lucide-react'
import { api } from '@/api/client'
import { useYard } from '@/contexts/useYard'
import { ScanPhoto } from '@/components/ScanPhoto'
import { HealthBadge } from '@/components/HealthBadge'
import { Pagination, paginate } from '@/components/Pagination'
import type { Mission, PlantScan } from '@/api/types'

function exportPDF(mission: Mission, scans: PlantScan[], healthy: number) {
  const rows = scans.map(s => {
    const label = s.waypoint.label ?? `#${s.waypoint.sequence + 1}`
    const health = s.health_status
      ? s.health_status.charAt(0).toUpperCase() + s.health_status.slice(1)
      : 'Unknown'
    const healthColor = s.health_status?.toLowerCase() === 'healthy' ? '#10b981' : '#ef4444'
    const confidence = s.probability != null ? `${(s.probability * 100).toFixed(0)}% confidence` : ''
    return `
      <div class="card">
        <img src="${api.scans.photoUrl(s.id)}" alt="${label}" onerror="this.style.display='none'" />
        <div class="card-body">
          <div class="label">${label}</div>
          <div class="plant">${s.plant_name ?? 'Unknown plant'}</div>
          <div class="health" style="color:${healthColor}">${health}</div>
          ${s.diseases ? `<div class="diseases">${s.diseases}</div>` : ''}
          ${confidence ? `<div class="confidence">${confidence}</div>` : ''}
        </div>
      </div>`
  }).join('')

  const date = new Date().toLocaleDateString(undefined, { dateStyle: 'long' })
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Scan Report — ${mission.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; color: #1e293b; padding: 2rem; }
    h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem; }
    .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
    .stat { border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem; }
    .stat-label { font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }
    .accent { color: #10b981; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; break-inside: avoid; }
    .card img { width: 100%; height: 120px; object-fit: cover; display: block; }
    .card-body { padding: 0.5rem 0.75rem 0.75rem; }
    .label { font-size: 0.65rem; color: #94a3b8; margin-bottom: 0.2rem; }
    .plant { font-size: 0.85rem; font-weight: 600; }
    .health { font-size: 0.75rem; font-weight: 500; margin-top: 0.2rem; }
    .diseases { font-size: 0.7rem; color: #64748b; margin-top: 0.15rem; }
    .confidence { font-size: 0.65rem; color: #94a3b8; margin-top: 0.25rem; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${mission.name}</h1>
  <p class="meta">Generated ${date} · ${scans.length} scan${scans.length !== 1 ? 's' : ''}</p>
  <div class="stats">
    <div class="stat"><div class="stat-label">Total</div><div class="stat-value">${scans.length}</div></div>
    <div class="stat"><div class="stat-label">Healthy</div><div class="stat-value accent">${healthy}</div></div>
    <div class="stat"><div class="stat-label">Unhealthy</div><div class="stat-value">${scans.length - healthy}</div></div>
    <div class="stat"><div class="stat-label">Health Rate</div><div class="stat-value">${scans.length > 0 ? Math.round((healthy / scans.length) * 100) : 0}%</div></div>
  </div>
  <div class="grid">${rows}</div>
  <script>window.onload = () => { window.print() }<\/script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) { alert('Allow pop-ups to export PDF'); return }
  win.document.write(html)
  win.document.close()
}

const PER_PAGE = 12

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
  const [page, setPage] = useState(1)

  const { data: missions } = useQuery({
    queryKey: ['missions', activeYardId],
    queryFn: () => api.missions.list(activeYardId),
  })

  const { data: scans, isLoading } = useQuery({
    queryKey: ['scans', selectedId],
    queryFn: () => api.scans.forMission(selectedId!),
    enabled: selectedId !== null,
  })

  const selectedMission = missions?.find(m => m.id === selectedId) ?? null
  const total = scans?.length ?? 0
  const healthy = scans?.filter(s => s.health_status?.toLowerCase().toLowerCase() === 'healthy').length ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)
  const visibleScans = scans ? paginate(scans, page, PER_PAGE) : []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Results</h1>
        {selectedMission && scans && total > 0 && (
          <button
            onClick={() => exportPDF(selectedMission, scans, healthy)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-3 py-1.5 rounded transition-colors"
          >
            <FileDown size={14} />
            Export PDF
          </button>
        )}
      </div>

      <div className="bg-slate-900 rounded-xl p-4">
        <select
          value={selectedId ?? ''}
          onChange={e => { setSelectedId(e.target.value ? Number(e.target.value) : null); setPage(1) }}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">— select a mission —</option>
          {missions?.map(m => (
            <option key={m.id} value={m.id}>{m.name} · {m.status.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}</option>
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
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleScans.map(scan => <ScanCard key={scan.id} scan={scan} />)}
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </>
      )}
    </div>
  )
}
