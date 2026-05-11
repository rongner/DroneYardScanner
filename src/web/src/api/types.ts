export interface Yard {
  id: number
  name: string
}

export interface Waypoint {
  id: number
  sequence: number
  latitude: number
  longitude: number
  label: string | null
}

export interface Mission {
  id: number
  name: string
  status: 'planned' | 'flying' | 'completed' | 'failed'
  yard_id: number | null
  created_at: string
  waypoints: Waypoint[]
}

export interface WaypointBrief {
  id: number
  sequence: number
  latitude: number
  longitude: number
  label: string | null
}

export interface PlantScan {
  id: number
  waypoint_id: number
  waypoint: WaypointBrief
  photo_path: string
  plant_name: string | null
  health_status: string | null
  diseases: string | null
  probability: number | null
  scanned_at: string
}

export interface PlantSummary {
  label: string
  scan_count: number
  latest_health: string | null
  first_seen: string
  last_seen: string
  latitude: number
  longitude: number
}

export interface DroneStatus {
  connected: boolean
  battery: number | null
}

export interface FlightMessage {
  type: 'status' | 'waypoint' | 'photo' | 'error' | 'complete'
  message: string
  mission_id?: number
}

export interface WaypointInput {
  sequence: number
  latitude: number
  longitude: number
  label?: string
}
