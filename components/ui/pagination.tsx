import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const PAGE_SIZE = 10

type Props = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft />
        <span className="sr-only">Forrige side</span>
      </Button>
      <span className="text-sm text-muted-foreground">
        Side {page} av {totalPages}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        <ChevronRight />
        <span className="sr-only">Neste side</span>
      </Button>
    </div>
  )
}
