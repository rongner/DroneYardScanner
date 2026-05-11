import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { useYard } from '@/contexts/YardContext'

const navItems = [
  { to: '/', label: 'Plan' },
  { to: '/simulate', label: 'Simulate' },
  { to: '/fly', label: 'Fly' },
  { to: '/results', label: 'Results' },
  { to: '/plants', label: 'Plant History' },
]

function YardSelector() {
  const { yards, activeYardId, setActiveYardId, addYard } = useYard()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  async function handleAdd() {
    const name = newName.trim()
    if (!name) return
    await addYard(name)
    setNewName('')
    setAdding(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') void handleAdd()
    if (e.key === 'Escape') { setAdding(false); setNewName('') }
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      {adding ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type="text"
            placeholder="Yard name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={handleKey}
            className="bg-slate-800 border border-slate-600 text-sm rounded px-2 py-1 w-36 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button onClick={() => void handleAdd()} className="text-emerald-400 hover:text-emerald-300 text-sm px-2">
            Save
          </button>
          <button onClick={() => { setAdding(false); setNewName('') }} className="text-slate-500 hover:text-slate-300">
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <select
            value={activeYardId ?? ''}
            onChange={e => setActiveYardId(e.target.value ? Number(e.target.value) : null)}
            className="bg-slate-800 border border-slate-700 text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="">All Yards</option>
            {yards.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <button
            onClick={() => setAdding(true)}
            title="New yard"
            className="text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <Plus size={16} />
          </button>
        </>
      )}
    </div>
  )
}

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <nav className="bg-slate-900 border-b border-slate-800 px-6 h-14 flex items-center gap-6 shrink-0">
        <span className="font-bold text-emerald-400 text-sm tracking-wide shrink-0">Drone Yard Scanner</span>
        <div className="flex items-center gap-5">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <YardSelector />
      </nav>
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  )
}
