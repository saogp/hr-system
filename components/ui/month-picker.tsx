'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const MONTHS_NO = [
  'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
]

function parseMonthValue(value: string): { year: number; month: number } | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7)) - 1
  return { year, month }
}

export function MonthPicker({
  value,
  onChange,
  placeholder = 'Velg måned',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const parsed = parseMonthValue(value)
  const [viewYear, setViewYear] = React.useState(parsed?.year ?? new Date().getFullYear())

  React.useEffect(() => {
    if (parsed) setViewYear(parsed.year)
  }, [value])

  const label = parsed ? `${MONTHS_NO[parsed.month]} ${parsed.year}` : placeholder

  const handleSelectMonth = (monthIndex: number) => {
    const mm = String(monthIndex + 1).padStart(2, '0')
    onChange(`${viewYear}-${mm}`)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className={cn('truncate', !parsed && 'text-muted-foreground')}>{label}</span>
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <PopoverContent
        align="start"
        collisionAvoidance={{ side: 'flip', align: 'none' }}
        className="w-64"
      >
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setViewYear((y) => y - 1)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-semibold text-brand-navy dark:text-white">{viewYear}</span>
          <button
            type="button"
            onClick={() => setViewYear((y) => y + 1)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {MONTHS_NO.map((m, i) => {
            const selected = parsed?.year === viewYear && parsed?.month === i
            return (
              <button
                key={m}
                type="button"
                onClick={() => handleSelectMonth(i)}
                className={cn(
                  'rounded-full px-2 py-1.5 text-xs font-medium transition-colors',
                  selected
                    ? 'bg-brand-orange text-brand-navy'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                {m.slice(0, 3)}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
