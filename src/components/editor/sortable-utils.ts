import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { newId } from '@/lib/bakers'

/** Editor-only stable key for list rows (never written to files). */
export const withKey = <T extends object>(x: T): T & { key: string } => ({ ...x, key: (x as { key?: string }).key ?? newId() })

/** Mouse/touch drag starts only from the handle (after a small move, so taps still work); keyboard uses Space + arrows. */
export function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}
