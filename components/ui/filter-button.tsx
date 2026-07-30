'use client'

import { Filter } from 'lucide-react'
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
          <Button variant="outline" className="shrink-0">
            <Filter className="size-4" />
            Filter
            {activeCount > 0 && (
              <Badge className="bg-brand-orange/15 text-brand-navy dark:text-brand-orange hover:bg-brand-orange/15 ml-0.5">
                {activeCount}
              </Badge>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="flex flex-col gap-4 w-72">
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
