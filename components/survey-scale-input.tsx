import { cn } from '@/lib/utils'

const FACES = ['😞', '🙁', '😐', '🙂', '😄']

export function ScaleInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange?: (value: string) => void
  disabled?: boolean
}) {
  const answered = Boolean(value)
  const num = answered ? Number(value) : 3
  const face = FACES[num - 1] ?? '😐'

  return (
    <div className={cn('rounded-xl border p-4 transition-colors', answered ? 'border-brand-orange/40 bg-brand-orange/5' : 'border-input bg-white dark:bg-white/5')}>
      <div className="flex justify-center mb-3">
        <span className={cn('text-4xl transition-transform', answered && 'scale-110')} aria-hidden>
          {answered ? face : '🤔'}
        </span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={num}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full accent-brand-orange h-2 cursor-pointer disabled:cursor-not-allowed"
      />
      <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
        <span>Helt uenig</span>
        {!answered && !disabled && <span>Dra for å svare</span>}
        <span>Helt enig</span>
      </div>
    </div>
  )
}
