interface Props {
  status: string | null
  fallback?: string
}

export function HealthBadge({ status, fallback }: Props) {
  if (!status) {
    return fallback
      ? <span className="text-xs text-slate-500">{fallback}</span>
      : null
  }
  const healthy = status.toLowerCase() === 'healthy'
  const label = status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${healthy ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
      {label}
    </span>
  )
}
