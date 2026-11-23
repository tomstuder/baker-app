import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        active ? 'border-primary bg-primary text-primary-foreground [&_span]:text-primary-foreground/75' : 'hover:border-primary/50',
      )}
    >
      {children}
    </button>
  )
}
