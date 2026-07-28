import { cn } from '@/lib/utils'

export function ScaleInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange?: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange?.(String(n))}
            className={cn(
              'flex-1 h-10 rounded-md border text-sm font-medium transition-colors',
              value === String(n)
                ? 'bg-brand-orange border-brand-orange text-brand-navy'
                : 'border-input bg-white dark:bg-white/5 hover:bg-muted/50',
              disabled && 'opacity-70'
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>Helt uenig</span>
        <span>Helt enig</span>
      </div>
    </div>
  )
}
