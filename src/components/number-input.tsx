import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const parsed = text.trim() === '' ? Number.NaN : Number(text)
    if (!Object.is(parsed, value) && !(Number.isNaN(parsed) && Number.isNaN(value))) {
      setText(Number.isFinite(value) ? String(value) : '')
    }
    // Only resync when the value changes from outside (reset, preset); typing updates text itself.
  }, [value])

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
