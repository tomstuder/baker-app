import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

type HandleProps = { attributes: DraggableAttributes; listeners: DraggableSyntheticListeners; setActivatorNodeRef: (el: HTMLElement | null) => void }
const HandleContext = createContext<HandleProps | null>(null)

/** A row that can be dragged by its <DragHandle />. */
export function SortableRow({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: CSSProperties = { transform: CSS.Translate.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className={cn(className, isDragging && 'relative z-10 opacity-90 shadow-lg ring-2 ring-primary/40')}>
      <HandleContext.Provider value={{ attributes, listeners, setActivatorNodeRef }}>{children}</HandleContext.Provider>
    </div>
  )
}

export function DragHandle({ label }: { label: string }) {
  const handle = useContext(HandleContext)
  if (!handle) return null
  const { attributes, listeners, setActivatorNodeRef } = handle
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={label}
      title="Drag to reorder (or focus and press Space, then the arrow keys)"
      className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </button>
  )
}
