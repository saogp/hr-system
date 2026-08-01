'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronRight, MessageSquare, MoreHorizontal, Search } from 'lucide-react'
import { ListPageSkeleton } from '@/components/ui/loading-skeletons'
import { IconBadge } from '@/components/ui/icon-badge'
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { FilterButton, FilterField, FilterChips } from '@/components/ui/filter-button'
import { MonthPicker } from '@/components/ui/month-picker'

type PersonOption = {
  id: string
  full_name: string | null
  email: string | null
}

type Company = { id: string; name: string }

type ReviewRow = {
  id: string
  scheduled_date: string
  status: 'open' | 'completed'
  employee_id: string
  leader_id: string | null
  profiles: { full_name: string | null; email: string | null } | null
}

export default function ReviewsPage() {
  const router = useRouter()
  const [role, setRole] = useState<'admin' | 'manager' | 'employee' | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [people, setPeople] = useState<PersonOption[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [employeeCompanies, setEmployeeCompanies] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'completed'>('all')
  const [leaderFilter, setLeaderFilter] = useState('all')
  const [page, setPage] = useState(1)

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }
    setCurrentUserId(user.id)

    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const currentRole = applyRoleOverride(viewerProfile?.role ?? 'employee') as 'admin' | 'manager' | 'employee'
    setRole(currentRole)

    if (isAdminLike(currentRole)) {
      const { data: peopleData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name')
      if (peopleData) setPeople(peopleData)

      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .order('name')
      if (companiesData) setCompanies(companiesData)

      const { data: pcData } = await supabase
        .from('profile_companies')
        .select('profile_id, company_id')
      if (pcData) {
        const map: Record<string, string[]> = {}
        for (const row of pcData) {
          map[row.profile_id] = [...(map[row.profile_id] ?? []), row.company_id]
        }
        setEmployeeCompanies(map)
      }

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('id, scheduled_date, status, employee_id, leader_id, profiles!reviews_employee_id_fkey(full_name, email)')
        .order('scheduled_date', { ascending: false })
      if (reviewsData) setReviews(reviewsData as unknown as ReviewRow[])
    } else {
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('id, scheduled_date, status, employee_id, leader_id, profiles!reviews_employee_id_fkey(full_name, email)')
        .or(`employee_id.eq.${user.id},leader_id.eq.${user.id}`)
        .order('scheduled_date', { ascending: false })
      if (reviewsData) setReviews(reviewsData as unknown as ReviewRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, companyFilter, monthFilter, statusFilter, leaderFilter])

  const handleDeleteReview = async () => {
    if (!deleteTargetId) return
    setDeleting(true)

    const { error } = await supabase.from('reviews').delete().eq('id', deleteTargetId)
    if (!error) {
      setReviews(prev => prev.filter(r => r.id !== deleteTargetId))
      setDeleteTargetId(null)
    }
    setDeleting(false)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) {
    return <ListPageSkeleton />
  }

  const filteredReviews = reviews.filter((r) => {
    if (search) {
      const name = (r.profiles?.full_name || r.profiles?.email || '').toLowerCase()
      if (!name.includes(search.toLowerCase())) return false
    }
    if (companyFilter !== 'all' && !(employeeCompanies[r.employee_id] ?? []).includes(companyFilter)) return false
    if (monthFilter && !r.scheduled_date.startsWith(monthFilter)) return false
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (leaderFilter !== 'all' && r.leader_id !== leaderFilter) return false
    return true
  })
  const activeFilterCount = [companyFilter !== 'all', !!monthFilter, statusFilter !== 'all', leaderFilter !== 'all'].filter(Boolean).length
  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / PAGE_SIZE))
  const pagedReviews = filteredReviews.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="max-w-[1440px] p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
          <IconBadge icon={<MessageSquare className="size-4" />} />
          Medarbeidersamtaler
        </h1>
        <p className="text-muted-foreground text-sm">
          {isAdminLike(role) ? 'Alle medarbeidersamtaler.' : 'Dine medarbeidersamtaler.'}
        </p>
      </div>

      {isAdminLike(role) && (
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex flex-row items-center gap-3">
            <div className="relative sm:max-w-xs w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Søk etter ansatt..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 rounded-full"
              />
            </div>
            <FilterButton activeCount={activeFilterCount}>
              <FilterField label="Restaurant">
                <FilterChips
                  value={companyFilter}
                  onChange={setCompanyFilter}
                  options={[
                    { value: 'all', label: 'Alle restauranter' },
                    ...companies.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </FilterField>
              <FilterField label="Status">
                <FilterChips
                  value={statusFilter}
                  onChange={(val) => setStatusFilter(val as typeof statusFilter)}
                  options={[
                    { value: 'all', label: 'Alle statuser' },
                    { value: 'open', label: 'Åpen' },
                    { value: 'completed', label: 'Fullført' },
                  ]}
                />
              </FilterField>
              <FilterField label="Leder">
                <FilterChips
                  value={leaderFilter}
                  onChange={setLeaderFilter}
                  options={[
                    { value: 'all', label: 'Alle ledere' },
                    ...people.map((p) => ({ value: p.id, label: p.full_name || p.email || '' })),
                  ]}
                />
              </FilterField>
              <FilterField label="Måned">
                <MonthPicker value={monthFilter} onChange={setMonthFilter} />
              </FilterField>
              {activeFilterCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit self-start -mt-1"
                  onClick={() => { setCompanyFilter('all'); setStatusFilter('all'); setLeaderFilter('all'); setMonthFilter('') }}
                >
                  Nullstill filter
                </Button>
              )}
            </FilterButton>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="lg"
              onClick={() => router.push('/reviews/new')}
              disabled={people.length === 0}
              className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
            >
              Ny samtale
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filteredReviews.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            Ingen medarbeidersamtaler funnet.
          </p>
        ) : (
          pagedReviews.map((r) => {
            const rowContent = (
              <>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-base md:text-sm truncate">
                    {r.profiles?.full_name || r.profiles?.email || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.scheduled_date)}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.status === 'completed' ? (
                    <Badge className="bg-green-600 hover:bg-green-700">Fullført</Badge>
                  ) : (
                    <Badge variant="secondary">Åpen</Badge>
                  )}
                  {role === 'admin' && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal />
                              <span className="sr-only">Handlinger</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargetId(r.id)}>
                            Slett
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                  {!isAdminLike(role) && <ChevronRight className="size-4 text-muted-foreground" />}
                </div>
              </>
            )

            return isAdminLike(role) ? (
              <div
                key={r.id}
                onClick={() => router.push(`/reviews/${r.id}`)}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white dark:bg-white/5 p-4 hover:bg-muted/50 cursor-pointer"
              >
                {rowContent}
              </div>
            ) : (
              <Link
                key={r.id}
                href={`/reviews/${r.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white dark:bg-white/5 p-4 hover:bg-muted/50"
              >
                {rowContent}
              </Link>
            )
          })
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette medarbeidersamtalen permanent. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDeleteReview}
            >
              {deleting ? 'Sletter...' : 'Slett'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
