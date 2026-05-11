import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { Yard } from '@/api/types'

interface YardCtx {
  yards: Yard[]
  activeYardId: number | null
  setActiveYardId: (id: number | null) => void
  addYard: (name: string) => Promise<Yard>
  removeYard: (id: number) => Promise<void>
}

const YardContext = createContext<YardCtx | null>(null)

export function YardProvider({ children }: { children: ReactNode }) {
  const [activeYardId, setActiveYardIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem('dys_activeYardId')
    return stored ? Number(stored) : null
  })

  const qc = useQueryClient()
  const { data: yards = [] } = useQuery({ queryKey: ['yards'], queryFn: api.yards.list })

  // Clear stale localStorage ID if the yard was deleted in another tab or session
  useEffect(() => {
    if (yards.length > 0 && activeYardId !== null && !yards.some(y => y.id === activeYardId)) {
      setActiveYardId(null)
    }
  }, [yards, activeYardId])

  const addMutation = useMutation({
    mutationFn: (name: string) => api.yards.create(name),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['yards'] }) },
  })

  const removeMutation = useMutation({
    mutationFn: (id: number) => api.yards.remove(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['yards'] }) },
  })

  function setActiveYardId(id: number | null) {
    setActiveYardIdState(id)
    if (id == null) localStorage.removeItem('dys_activeYardId')
    else localStorage.setItem('dys_activeYardId', String(id))
  }

  async function addYard(name: string) {
    const yard = await addMutation.mutateAsync(name)
    setActiveYardId(yard.id)
    return yard
  }

  async function removeYard(id: number) {
    await removeMutation.mutateAsync(id)
    if (activeYardId === id) setActiveYardId(null)
  }

  return (
    <YardContext.Provider value={{ yards, activeYardId, setActiveYardId, addYard, removeYard }}>
      {children}
    </YardContext.Provider>
  )
}

export function useYard() {
  const ctx = useContext(YardContext)
  if (!ctx) throw new Error('useYard must be used within YardProvider')
  return ctx
}
