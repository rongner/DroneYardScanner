import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, ChevronRight, CheckCircle, Trash2 } from 'lucide-react'
import { ScanPhoto } from '@/components/ScanPhoto'
import { HealthBadge } from '@/components/HealthBadge'
import L from 'leaflet'
import { api } from '@/api/client'
import { useYard } from '@/contexts/useYard'
import type { PlantScan } from '@/api/types'

function mapIcon(seq: number, active: boolean) {
  const bg = active ? '#3b82f6' : '#475569'
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5)">${seq + 1}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export default function SimulatePage() {
  const [searchParams] = useSearchParams()
  const { activeYardId } = useYard()
  const [selectedId, setSelectedId] = useState<number | null>(
    searchParams.get('mission') ? Number(searchParams.get('mission')) : null,
  )
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)
  const [results, setResults] = useState<Map<number, PlantScan>>(new Map())
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])

  const { data: missions } = useQuery({
    queryKey: ['missions', activeYardId],
    queryFn: () => api.missions.list(activeYardId),
  })

  const deleteMission = useMutation({
    mutationFn: (id: number) => api.missions.remove(id),
    onSuccess: () => {
      setSelectedId(null)
      void qc.invalidateQueries({ queryKey: ['missions'] })
    },
  })

  const { data: mission } = useQuery({
    queryKey: ['mission', selectedId],
    queryFn: () => api.missions.get(selectedId!),
    enabled: selectedId !== null,
  })

  const waypoints = useMemo(() => mission?.waypoints ?? [], [mission?.waypoints])
  const currentWp = waypoints[step]
  const allDone = started && step >= waypoints.length

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !started) return

    const map = L.map(mapContainerRef.current).setView([37.7749, -122.4194], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [started])

  useEffect(() => {
    const map = mapRef.current
    if (!map || waypoints.length === 0) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    waypoints.forEach((wp, i) => {
      const marker = L.marker([wp.latitude, wp.longitude], { icon: mapIcon(i, i === step) })
        .addTo(map)
        .bindPopup(wp.label || `Waypoint ${i + 1}`)
      markersRef.current.push(marker)
    })

    if (currentWp) map.setView([currentWp.latitude, currentWp.longitude], 18)
  }, [step, waypoints, currentWp])

  async function uploadFile(file: File) {
    if (!selectedId || !currentWp) return
    setUploading(true)
    setUploadError(null)
    try {
      const scan = await api.scans.simulate(selectedId, currentWp.sequence, file)
      setResults(prev => new Map(prev).set(step, scan))
    } catch {
      setUploadError('Upload failed — check your connection and try again')
    } finally {
      setUploading(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    await uploadFile(file)
    e.target.value = ''
  }

  function handleDeleteMission() {
    if (!selectedId) return
    const name = missions?.find(m => m.id === selectedId)?.name ?? 'this mission'
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    deleteMission.mutate(selectedId)
  }

  function nextStep() {
    setStep(s => s + 1)
    setUploadError(null)
  }

  if (!started) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold">Simulate Walk</h1>
        <p className="text-slate-400 text-sm">
          Walk your yard yourself and photograph each plant. Photos are sent to Kindwise for health analysis — no drone required.
        </p>

        <div className="bg-slate-900 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Mission</h2>
          {missions?.length === 0 ? (
            <p className="text-sm text-slate-400">
              No missions yet.{' '}
              <Link to="/" className="text-emerald-400 underline">Create one on the Plan page.</Link>
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <select
                  value={selectedId ?? ''}
                  onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">— choose a mission —</option>
                  {missions?.map(m => (
                    <option key={m.id} value={m.id}>{m.name} · {m.waypoints?.length ?? 0} waypoints</option>
                  ))}
                </select>
                <button
                  onClick={handleDeleteMission}
                  disabled={!selectedId || deleteMission.isPending}
                  title="Delete selected mission"
                  className="px-3 text-slate-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <button
                onClick={() => setStarted(true)}
                disabled={!selectedId || !mission || waypoints.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded transition-colors"
              >
                Start Walk
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  if (allDone) {
    const healthy = [...results.values()].filter(s => s.health_status?.toLowerCase() === 'healthy').length
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6 text-center">
        <div className="flex justify-center">
          <CheckCircle size={56} className="text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold">Walk Complete!</h1>
        <p className="text-slate-400">
          Scanned {results.size} of {waypoints.length} plants —{' '}
          <span className="text-emerald-400">{healthy} healthy</span>,{' '}
          <span className="text-red-400">{results.size - healthy} issues found</span>
        </p>
        <div className="flex justify-center gap-3">
          <Link
            to={`/results`}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded transition-colors"
          >
            View Full Results
          </Link>
          <button
            onClick={() => { setStarted(false); setStep(0); setResults(new Map()) }}
            className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-5 py-2.5 rounded transition-colors"
          >
            New Walk
          </button>
        </div>
      </div>
    )
  }

  const currentResult = results.get(step)

  return (
    <div className="flex flex-col md:flex-row" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Map */}
      <div ref={mapContainerRef} className="h-52 md:h-auto md:flex-1 min-h-0" />

      {/* Step panel */}
      <div className="md:w-96 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto">
        {/* Progress */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">
              Waypoint {step + 1} of {waypoints.length}
            </span>
            <span className="text-xs text-slate-500">{results.size} scanned</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${((step) / waypoints.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Current waypoint info */}
        {currentWp && (
          <div className="p-4 border-b border-slate-800 space-y-1">
            {currentWp.label ? (
              <p className="font-semibold text-emerald-300">{currentWp.label}</p>
            ) : (
              <p className="font-semibold text-slate-300">Waypoint {step + 1}</p>
            )}
            <p className="text-xs text-slate-500">
              {currentWp.latitude.toFixed(6)}, {currentWp.longitude.toFixed(6)}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Walk to this location, then photograph the plant.
            </p>
          </div>
        )}

        {/* Photo capture */}
        <div className="p-4 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />

          {!currentResult && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
            >
              <Camera size={18} />
              {uploading ? 'Analysing…' : 'Take Photo'}
            </button>
          )}

          {uploadError && (
            <div className="space-y-1">
              <p className="text-xs text-red-400">{uploadError}</p>
              {pendingFile && (
                <button
                  onClick={() => void uploadFile(pendingFile)}
                  disabled={uploading}
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                >
                  {uploading ? 'Retrying…' : 'Retry upload'}
                </button>
              )}
            </div>
          )}

          {/* Result card */}
          {currentResult && (
            <div className="bg-slate-800 rounded-xl overflow-hidden">
              <ScanPhoto
                src={api.scans.photoUrl(currentResult.id)}
                className="w-full h-40"
              />
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{currentResult.plant_name ?? 'Unknown plant'}</p>
                  <HealthBadge status={currentResult.health_status} />
                </div>
                {currentResult.diseases && (
                  <p className="text-xs text-slate-400">{currentResult.diseases}</p>
                )}
                {currentResult.probability != null && (
                  <p className="text-xs text-slate-600">{(currentResult.probability * 100).toFixed(0)}% confidence</p>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {!currentResult && (
              <button
                onClick={nextStep}
                className="flex-1 text-slate-400 hover:text-slate-200 text-sm py-2 rounded border border-slate-700 hover:border-slate-500 transition-colors"
              >
                Skip
              </button>
            )}
            {currentResult && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 text-slate-400 hover:text-slate-200 text-sm py-2 rounded border border-slate-700 hover:border-slate-500 transition-colors"
                >
                  Retake
                </button>
                <button
                  onClick={nextStep}
                  className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 rounded transition-colors"
                >
                  Next <ChevronRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
