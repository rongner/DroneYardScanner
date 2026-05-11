import { useContext } from 'react'
import { YardContext } from './YardContext'

export function useYard() {
  const ctx = useContext(YardContext)
  if (!ctx) throw new Error('useYard must be used within YardProvider')
  return ctx
}
