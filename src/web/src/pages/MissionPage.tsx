import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { MapPin, Trash2, Save } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useYard } from '@/contexts/useYard'
import type { WaypointInput } from '@/api/types'

interface DraftWaypoint {
  lat: number
  lon: number
  label: string
}

function numberedIcon(n: number) {
  return L.divIcon({
    className: '',
    html: `<div style="background:#10b981;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5)">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export default function MissionPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const polylineRef = useRef<L.Polyline | null>(null)
  const navigate = useNavigate()
  const { activeYardId } = useYard()

  const [waypoints, setWaypoints] = useState<DraftWaypoint[]>([])
  const [missionName, setMissionName] = useState('')
  const [pendingLabel, setPendingLabel] = useState('')
  const [gpsDenied, setGpsDenied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current).setView([37.7749, -122.4194], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    mapRef.current = map

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => map.setView([pos.coords.latitude, pos.coords.longitude], 18),
        () => setGpsDenied(true),
      )
    }

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    polylineRef.current?.remove()
    polylineRef.current = null

    waypoints.forEach((wp, i) => {
      const marker = L.marker([wp.lat, wp.lon], { icon: numberedIcon(i + 1) })
        .addTo(map)
        .bindPopup(wp.label || `Waypoint ${i + 1}`)
      markersRef.current.push(marker)
    })

    if (waypoints.length >= 2) {
      polylineRef.current = L.polyline(
        waypoints.map(wp => [wp.lat, wp.lon] as L.LatLngTuple),
        { color: '#10b981', weight: 2, dashArray: '5 5' },
      ).addTo(map)
    }
  }, [waypoints])

  function markWaypoint() {
    navigator.geolocation.getCurrentPosition(
      pos => {
        setWaypoints(prev => [
          ...prev,
          { lat: pos.coords.latitude, lon: pos.coords.longitude, label: pendingLabel },
        ])
        setPendingLabel('')
        setGpsDenied(false)
      },
      () => {
        setGpsDenied(true)
        setError('GPS access denied — enable location permissions')
      },
    )
  }

  function removeWaypoint(index: number) {
    setWaypoints(prev => prev.filter((_, i) => i !== index))
  }

  async function saveMission() {
    if (!missionName.trim()) { setError('Enter a mission name'); return }
    if (waypoints.length < 2) { setError('Add at least 2 waypoints'); return }
    setSaving(true)
    setError(null)
    try {
      const formatted: WaypointInput[] = waypoints.map((wp, i) => ({
        sequence: i,
        latitude: wp.lat,
        longitude: wp.lon,
        label: wp.label || undefined,
      }))
      const mission = await api.missions.create(missionName.trim(), formatted, activeYardId)
      navigate(`/simulate?mission=${mission.id}`)
    } catch {
      setError('Failed to save mission')
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col md:flex-row" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <div ref={mapContainerRef} className="flex-1 min-h-64" />

      <div className="md:w-80 bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-semibold">Plan Mission</h1>
          <p className="text-xs text-slate-400 mt-1">Walk your yard and mark waypoints</p>
          {activeYardId === null && (
            <p className="text-xs text-amber-400 mt-2">Select a yard in the nav to associate this mission</p>
          )}
        </div>

        <div className="p-4 space-y-2 border-b border-slate-800">
          <input
            type="text"
            placeholder="Mission name"
            value={missionName}
            onChange={e => setMissionName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <input
            type="text"
            placeholder="Plant label (optional, e.g. Rose Bush 1)"
            value={pendingLabel}
            onChange={e => setPendingLabel(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            onClick={markWaypoint}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2 rounded transition-colors"
          >
            <MapPin size={15} />
            Mark Waypoint Here
          </button>
          {gpsDenied && (
            <p className="text-xs text-amber-400">Enable location permissions to use GPS</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {waypoints.length === 0 ? (
            <p className="text-sm text-slate-500 text-center mt-10">
              No waypoints yet.<br />Walk to a plant and tap Mark.
            </p>
          ) : (
            waypoints.map((wp, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-800 rounded px-3 py-2">
                <span className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  {wp.label && <p className="text-xs font-medium text-slate-200 truncate">{wp.label}</p>}
                  <p className="text-xs text-slate-400 truncate">
                    {wp.lat.toFixed(6)}, {wp.lon.toFixed(6)}
                  </p>
                </div>
                <button
                  onClick={() => removeWaypoint(i)}
                  className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-800 space-y-2">
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={saveMission}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded transition-colors"
          >
            <Save size={15} />
            {saving ? 'Saving…' : `Save (${waypoints.length} waypoint${waypoints.length !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  )
}
