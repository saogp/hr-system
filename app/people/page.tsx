'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Users, Search } from 'lucide-react'
import { ListPageSkeleton } from '@/components/ui/loading-skeletons'
import { IconBadge } from '@/components/ui/icon-badge'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { logAudit } from '@/lib/audit-log'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal } from 'lucide-react'
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
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination'
import { FilterButton, FilterField, FilterChips } from '@/components/ui/filter-button'

type Person = {
  id: string
  full_name: string | null
  title: string | null
  role: string
  email: string | null
  end_date: string | null
  avatar_url: string | null
  is_active: boolean
}

type Company = {
  id: string
  name: string
}

function getRoleLabel(role: string) {
  switch (role) {
    case 'admin':
      return 'Admin'
    case 'manager':
      return 'Leder'
    default:
      return 'Ansatt'
  }
}

function getInitials(name: string) {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? ''
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export default function PeoplePage() {
  const router = useRouter()
  const [people, setPeople] = useState<Person[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isRealAdmin, setIsRealAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [roleFilter, setRoleFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [profileCompanies, setProfileCompanies] = useState<Record<string, string[]>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])

  const [deactivateTargetId, setDeactivateTargetId] = useState<string | null>(null)
  const [deactivateEndDate, setDeactivateEndDate] = useState('')
  const [deactivating, setDeactivating] = useState(false)

  const [inviteStatuses, setInviteStatuses] = useState<Record<string, { invited_at?: string; confirmed_at?: string }>>({})
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }

    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const viewerRole = applyRoleOverride(viewerProfile?.role ?? 'employee')
    const admin = isAdminLike(viewerRole)
    setIsAdmin(admin)
    setIsRealAdmin(viewerRole === 'admin')
    setCurrentUserId(user.id)

    if (admin) {
      const statusPromise = supabase.auth.getSession().then(({ data: { session } }) =>
        fetch('/api/employees', { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } })
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      )

      const [
        { data: profilesData },
        statusResult,
        { data: companiesData },
        { data: pcData },
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, title, role, email, end_date, avatar_url, is_active'),
        statusPromise,
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('profile_companies').select('profile_id, company_id'),
      ])

      if (profilesData) setPeople(profilesData)
      if (statusResult) setInviteStatuses(statusResult.statuses ?? {})
      if (companiesData) setCompanies(companiesData)
      if (pcData) {
        const map: Record<string, string[]> = {}
        for (const row of pcData) {
          map[row.profile_id] = [...(map[row.profile_id] ?? []), row.company_id]
        }
        setProfileCompanies(map)
      }
    } else {
      const { data } = await supabase.rpc('get_people_directory')
      if (data) setPeople(data.map((p: Person) => ({ ...p, end_date: null, is_active: true })))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleActivate = async (personId: string) => {
    const { error } = await supabase.from('profiles').update({ is_active: true }).eq('id', personId)
    if (!error) {
      setPeople(prev => prev.map(p => (p.id === personId ? { ...p, is_active: true } : p)))
      if (currentUserId) {
        const target = people.find((p) => p.id === personId)
        logAudit(currentUserId, 'employee_activated', personId, { target_name: target?.full_name ?? target?.email })
      }
    }
  }

  const handleConfirmDeactivate = async () => {
    if (!deactivateTargetId || !deactivateEndDate) return
    setDeactivating(true)

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false, end_date: deactivateEndDate })
      .eq('id', deactivateTargetId)

    if (!error) {
      setPeople(prev => prev.map(p => (p.id === deactivateTargetId ? { ...p, is_active: false, end_date: deactivateEndDate } : p)))
      if (currentUserId) {
        const target = people.find((p) => p.id === deactivateTargetId)
        logAudit(currentUserId, 'employee_deactivated', deactivateTargetId, { end_date: deactivateEndDate, target_name: target?.full_name ?? target?.email })
      }
      setDeactivateTargetId(null)
      setDeactivateEndDate('')
    }
    setDeactivating(false)
  }

  const handleResend = async (personId: string) => {
    setResendingId(personId)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/employees/${personId}/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
    })
    if (!res.ok) {
      const result = await res.json().catch(() => ({}))
      alert(result.error || 'Kunne ikke sende invitasjon på nytt.')
    }
    setResendingId(null)
  }

  const handleDelete = async () => {
    if (!deleteTargetId) return
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/employees/${deleteTargetId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })

    if (res.ok) {
      setPeople(prev => prev.filter(p => p.id !== deleteTargetId))
      setDeleteTargetId(null)
    } else {
      const result = await res.json().catch(() => ({}))
      alert(result.error || 'Kunne ikke slette ansatt.')
    }
    setDeleting(false)
  }

  useEffect(() => {
    setPage(1)
  }, [search, showInactive, roleFilter, companyFilter])


  if (loading) {
    return <ListPageSkeleton />
  }

  const filtered = people
    .filter((p) => (showInactive ? !p.is_active : p.is_active))
    .filter((p) => (p.full_name ?? '').toLowerCase().includes(search.toLowerCase()))
    .filter((p) => roleFilter === 'all' || p.role === roleFilter)
    .filter((p) => companyFilter === 'all' || (profileCompanies[p.id] ?? []).includes(companyFilter))
    .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'no'))
  const activeFilterCount = [roleFilter !== 'all', companyFilter !== 'all'].filter(Boolean).length
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="max-w-[1440px] p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
          <IconBadge icon={<Users className="size-4" />} />
          Ansatte
        </h1>
        <p className="text-muted-foreground text-sm">Oversikt over alle ansatte.</p>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex flex-row items-center gap-3">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Finn person..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 rounded-full"
            />
          </div>
          {isAdmin && (
            <FilterButton activeCount={activeFilterCount}>
              <FilterField label="Rolle">
                <FilterChips
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={[
                    { value: 'all', label: 'Alle roller' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'manager', label: 'Leder' },
                    { value: 'employee', label: 'Ansatt' },
                  ]}
                />
              </FilterField>
              <FilterField label="Bedrift">
                <FilterChips
                  value={companyFilter}
                  onChange={setCompanyFilter}
                  options={[
                    { value: 'all', label: 'Alle bedrifter' },
                    ...companies.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </FilterField>
              {activeFilterCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit self-start -mt-1"
                  onClick={() => { setRoleFilter('all'); setCompanyFilter('all') }}
                >
                  Nullstill filter
                </Button>
              )}
            </FilterButton>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="lg"
              variant={showInactive ? 'default' : 'outline'}
              className={showInactive ? 'bg-brand-navy text-white hover:bg-brand-navy/90' : 'border-brand-orange'}
              onClick={() => setShowInactive((v) => !v)}
            >
              {showInactive ? 'Aktive ansatte' : 'Inaktive ansatte'}
            </Button>
            <Button size="lg" render={<Link href="/people/new" />} className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium">
              Legg til ansatt
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Ingen treff.</p>
        ) : (
          paged.map((p) => (
            <Link
              key={p.id}
              href={`/people/${p.id}`}
              className={`group flex items-center gap-3 rounded-xl border border-border bg-white dark:bg-white/5 p-4 transition-colors hover:bg-brand-cream/60 dark:hover:bg-white/10 ${!p.is_active ? 'opacity-60' : ''}`}
            >
              <Avatar className="size-11 ring-2 ring-transparent transition-all group-hover:ring-brand-orange/40">
                {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.full_name ?? ''} />}
                <AvatarFallback className="bg-brand-navy text-brand-orange">{getInitials(p.full_name || '?')}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-base md:text-sm truncate">{p.full_name || '—'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.title || '—'}{isAdmin ? ` · ${getRoleLabel(p.role)}` : ''}
                </p>
              </div>
              {!p.is_active && <Badge variant="secondary">Inaktiv</Badge>}
              {isAdmin && (
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
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
                      {inviteStatuses[p.id]?.invited_at && !inviteStatuses[p.id]?.confirmed_at && (
                        <DropdownMenuItem disabled={resendingId === p.id} onClick={() => handleResend(p.id)}>
                          {resendingId === p.id ? 'Sender...' : 'Send invitasjon på nytt'}
                        </DropdownMenuItem>
                      )}
                      {p.is_active ? (
                        <DropdownMenuItem onClick={() => { setDeactivateTargetId(p.id); setDeactivateEndDate('') }}>
                          Gjør inaktiv
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleActivate(p.id)}>
                          Gjør aktiv
                        </DropdownMenuItem>
                      )}
                      {isRealAdmin && (
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargetId(p.id)}>
                          Slett
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </Link>
          ))
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={deactivateTargetId !== null} onOpenChange={(open) => { if (!open) { setDeactivateTargetId(null); setDeactivateEndDate('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gjør ansatt inaktiv</DialogTitle>
            <DialogDescription>
              Angi sluttdato for den ansatte før du gjør vedkommende inaktiv.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deactivate-end-date">Sluttdato</Label>
            <DateInput
              id="deactivate-end-date"
              value={deactivateEndDate}
              onChange={(e) => setDeactivateEndDate(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button
              variant="destructive"
              disabled={deactivating || !deactivateEndDate}
              onClick={handleConfirmDeactivate}
            >
              {deactivating ? 'Lagrer...' : 'Gjør inaktiv'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette den ansatte permanent, inkludert innloggingskontoen. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Sletter...' : 'Slett'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
