import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function IconBadge({ icon, className }: { icon: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'flex size-7 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-navy dark:text-brand-orange [&>svg]:size-5',
        className
      )}
    >
      {icon}
    </span>
  )
}
