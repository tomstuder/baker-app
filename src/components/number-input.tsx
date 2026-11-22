import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Props = {
  value: number
  onChange: (value: number) => void
  suffix?: string
  className?: string
  min?: number
  step?: number
  'aria-label'?: string
  id?: string
}

/**
 * Numeric input that keeps its own text while you type, so "0." or an empty field don't jump
 * around. Reports NaN while the field is blank; the math treats NaN as 0.
 */
export function NumberInput({ value, onChange, suffix, className, min = 0, step, ...rest }: Props) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : '')
  const [synced, setSynced] = useState(value)

  // When the value changes from outside (reset, loading a recipe), show it. Typing updates both
  // text and value together, so this only fires for outside changes. (Adjusting state during
  // render is React's recommended alternative to an effect here.)
  if (!Object.is(synced, value)) {
    setSynced(value)
    const parsed = text.trim() === '' ? Number.NaN : Number(text)
    if (!Object.is(parsed, value)) setText(Number.isFinite(value) ? String(value) : '')
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        {...rest}
        type="number"
        inputMode="decimal"
        min={min}
        step={step ?? 'any'}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange(e.target.value.trim() === '' ? Number.NaN : Number(e.target.value))
        }}
        className={cn('tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none', suffix && 'pr-7')}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  )
}
