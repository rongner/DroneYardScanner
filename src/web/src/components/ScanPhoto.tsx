import { useState } from 'react'
import { Leaf } from 'lucide-react'

interface Props {
  src: string
  alt?: string
  className?: string
}

export function ScanPhoto({ src, alt = 'Plant photo', className = '' }: Props) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-slate-800 text-slate-600 ${className}`}>
        <Leaf size={28} />
        <span className="text-xs">No photo</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  )
}
