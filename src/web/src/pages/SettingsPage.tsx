import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Save } from 'lucide-react'
import { api } from '@/api/client'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: api.settings.get })

  const [telloHost, setTelloHost] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const update = useMutation({
    mutationFn: (host: string) => api.settings.update({ tello_host: host }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const currentHost = telloHost ?? data?.tello_host ?? ''

  if (isLoading) {
    return <div className="p-6 text-slate-500 text-sm">Loading…</div>
  }

  return (
    <div className="p-6 max-w-lg mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="bg-slate-900 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Drone</h2>

        <div className="space-y-1.5">
          <label className="text-sm text-slate-300">Tello host / IP</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={currentHost}
              onChange={e => { setTelloHost(e.target.value); setSaved(false) }}
              placeholder="192.168.10.1"
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              onClick={() => update.mutate(currentHost)}
              disabled={update.isPending || currentHost === data?.tello_host}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm px-3 py-2 rounded transition-colors"
            >
              {saved ? <CheckCircle size={14} /> : <Save size={14} />}
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Changes take effect immediately — no restart needed.
          </p>
        </div>
      </section>

      <section className="bg-slate-900 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Storage</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Photo directory</span>
          <span className="text-sm text-slate-500 font-mono">{data?.photo_dir}</span>
        </div>
      </section>

      <section className="bg-slate-900 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Integrations</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Kindwise plant API</span>
          {data?.kindwise_configured
            ? <span className="flex items-center gap-1 text-emerald-400 text-sm"><CheckCircle size={14} /> Configured</span>
            : <span className="flex items-center gap-1 text-slate-500 text-sm"><XCircle size={14} /> Not set</span>
          }
        </div>
        {!data?.kindwise_configured && (
          <p className="text-xs text-slate-500">
            Set <code className="text-slate-400">KINDWISE_API_KEY</code> in your <code className="text-slate-400">.env</code> to enable plant identification.
          </p>
        )}
      </section>
    </div>
  )
}
