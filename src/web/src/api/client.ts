import axios from 'axios'
import type { Yard, Mission, PlantScan, PlantSummary, DroneStatus, WaypointInput } from './types'

const http = axios.create({ baseURL: '/api' })

export const api = {
  yards: {
    list: () => http.get<Yard[]>('/yards').then(r => r.data),
    create: (name: string) => http.post<Yard>('/yards', { name }).then(r => r.data),
    remove: (id: number) => http.delete(`/yards/${id}`),
  },
  missions: {
    list: (yardId?: number | null) =>
      http.get<Mission[]>('/missions', { params: yardId ? { yard_id: yardId } : {} }).then(r => r.data),
    get: (id: number) => http.get<Mission>(`/missions/${id}`).then(r => r.data),
    create: (name: string, waypoints: WaypointInput[], yardId: number | null) =>
      http.post<Mission>('/missions', { name, waypoints, yard_id: yardId }).then(r => r.data),
    remove: (id: number) => http.delete(`/missions/${id}`),
  },
  drone: {
    connect: () => http.post<{ battery: number }>('/drone/connect').then(r => r.data),
    disconnect: () => http.post('/drone/disconnect'),
    status: () => http.get<DroneStatus>('/drone/status').then(r => r.data),
  },
  scans: {
    forMission: (missionId: number) =>
      http.get<PlantScan[]>(`/scans/mission/${missionId}`).then(r => r.data),
    simulate: (missionId: number, sequence: number, photo: File) => {
      const form = new FormData()
      form.append('photo', photo)
      return http.post<PlantScan>(`/scans/simulate/${missionId}/${sequence}`, form).then(r => r.data)
    },
    plants: (yardId: number) =>
      http.get<PlantSummary[]>('/scans/plants', { params: { yard_id: yardId } }).then(r => r.data),
    plantHistory: (yardId: number, label: string) =>
      http.get<PlantScan[]>('/scans/plant-history', { params: { yard_id: yardId, label } }).then(r => r.data),
    photoUrl: (scanId: number) => `/api/scans/${scanId}/photo`,
  },
}
