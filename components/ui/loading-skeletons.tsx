import { Skeleton } from '@/components/ui/skeleton'

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72 max-w-full" />
    </div>
  )
}

export function ToolbarSkeleton() {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
      <Skeleton className="h-9 w-full sm:w-64" />
      <Skeleton className="h-9 w-36 self-end sm:self-auto" />
    </div>
  )
}

export function ListRowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-4 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  )
}

export function ListPageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="max-w-[1440px] p-6">
      <PageHeaderSkeleton />
      <ToolbarSkeleton />
      <ListRowsSkeleton count={rows} />
    </div>
  )
}

export function FormFieldsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
      <Skeleton className="h-9 w-32 mt-2" />
    </div>
  )
}

export function FormPageSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="p-6 max-w-[1440px]">
      <Skeleton className="h-4 w-32 mb-6" />
      <Skeleton className="h-7 w-56 mb-6" />
      <FormFieldsSkeleton count={fields} />
    </div>
  )
}

export function DetailPageSkeleton() {
  return (
    <div className="p-6 max-w-[1440px] space-y-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-64" />
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  )
}

export function ProfilePageSkeleton() {
  return (
    <div className="py-6 px-4 max-w-[1440px] space-y-6">
      <Skeleton className="h-4 w-16" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </div>
      <div className="space-y-3 border-t border-border pt-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-4 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-[1440px] p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border p-6 flex items-center justify-between gap-4">
          <div className="space-y-3 flex-1 max-w-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="size-36 rounded-full hidden sm:block shrink-0" />
        </div>
        <div className="rounded-xl border border-border p-6 space-y-4">
          <Skeleton className="h-5 w-28" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="size-4 rounded shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border p-6 space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="lg:col-span-2 rounded-xl border border-border p-6 space-y-4">
          <Skeleton className="h-5 w-28" />
          <div className="flex gap-6 items-center">
            <Skeleton className="h-10 w-14 shrink-0" />
            <div className="flex-1 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-2 w-full rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border p-6 space-y-3">
        <Skeleton className="h-5 w-20" />
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-14 flex-1" />
          <Skeleton className="h-14 flex-1" />
        </div>
      </div>
    </div>
  )
}

export function RenholdPageSkeleton() {
  return (
    <div className="max-w-[1440px] p-6">
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border overflow-hidden">
            <div className="bg-brand-cream dark:bg-white/5 p-3 flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-36" />
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 2 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between gap-2 p-3">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Skeleton className="h-5 w-24 mb-3" />
      <div className="rounded-md border border-input divide-y divide-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3 p-3">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="size-4 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CenteredCardSkeleton() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <Skeleton className="h-24 w-24 rounded-full mx-auto" />
        <Skeleton className="h-5 w-40 mx-auto" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  )
}
