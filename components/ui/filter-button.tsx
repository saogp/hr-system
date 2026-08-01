'use client'

import { Filter, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export function FilterButton({
  activeCount,
  children,
}: {
  activeCount: number
  children: React.ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="lg" className="relative shrink-0 rounded-full">
            <Filter className="size-4" />
            Filter
            {activeCount > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-brand-orange/15 text-brand-navy dark:text-brand-orange hover:bg-brand-orange/15">
                {activeCount}
              </Badge>
            )}
          </Button>
        }
      />
      <PopoverContent
        align="start"
        collisionAvoidance={{ side: 'none', align: 'shift' }}
        className="flex flex-col gap-4 w-96"
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

export function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              selected
                ? 'border-brand-orange bg-brand-orange text-brand-navy'
                : 'border-input bg-transparent text-foreground hover:bg-muted'
            )}
          >
            {selected && <Check className="size-3.5" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
