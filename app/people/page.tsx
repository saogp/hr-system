'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowUpAZ, ArrowDownAZ, Users } from 'lucide-react'
import { IconBadge } from '@/components/ui/icon-badge'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { StatTile } from '@/components/ui/stat-tile'
import { ChevronRight } from 'lucide-react'

type Person = {
  id: string
  full_name: string | null
  title: string | null
  role: string
  email: string | null
  end_date: string | null
  contractStatus: 'signed' | 'pending' | 'none'
  avatar_url: string | null
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function PeoplePage() {
  const router = useRouter()
  const [people, setPeople] = useState<Person[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

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
    const admin = isAdminLike(applyRoleOverride(viewerProfile?.role ?? 'employee'))
    setIsAdmin(admin)

    if (admin) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, title, role, email, end_date, avatar_url')
      const { data: contractsData } = await supabase
        .from('contracts')
        .select('profile_id, employee_signed_at, admin_signed_at')

      const statusByProfile = new Map<string, 'signed' | 'pending'>()
      for (const c of contractsData ?? []) {
        const fullySigned = Boolean(c.employee_signed_at && c.admin_signed_at)
        const current = statusByProfile.get(c.profile_id)
        if (!fullySigned) {
          statusByProfile.set(c.profile_id, 'pending')
        } else if (current !== 'pending') {
          statusByProfile.set(c.profile_id, 'signed')
        }
      }

      if (profilesData) {
        setPeople(profilesData.map((p) => ({
          ...p,
          contractStatus: statusByProfile.get(p.id) ?? 'none',
        })))
      }
    } else {
      const { data } = await supabase.rpc('get_people_directory')
      if (data) setPeople(data.map((p: Person) => ({ ...p, end_date: null, contractStatus: 'none' })))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteError('')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        email: newEmail,
        full_name: newName,
      }),
    })
    const result = await res.json()

    if (!res.ok) {
      setInviteError(result.error || 'Noe gikk galt.')
    } else {
      setAddOpen(false)
      setNewName('')
      setNewEmail('')
      load()
    }
    setInviting(false)
  }

  if (loading) {
    return <div className="p-8">Laster ansatte...</div>
  }

  const filtered = people
    .filter((p) => (p.full_name ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const cmp = (a.full_name ?? '').localeCompare(b.full_name ?? '', 'no')
      return sortDir === 'asc' ? cmp : -cmp
    })

  const today = new Date().toISOString().slice(0, 10)
  const activeCount = people.filter((p) => !p.end_date || p.end_date >= today).length

  return (
    <div className="max-w-4xl py-10 px-4">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
            <IconBadge icon={<Users className="size-4" />} />
            Ansatte
          </h1>
          <p className="text-muted-foreground text-sm">Oversikt over alle ansatte.</p>
        </div>
        {isAdmin && (
          <div className="w-full sm:w-48">
            <StatTile label="Aktive ansatte" value={activeCount} />
          </div>
        )}
      </div>

      <div className="flex flex-row items-center justify-between gap-4 mb-4">
        <div className="flex flex-row items-center gap-3">
          <Input
            placeholder="Finn person..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                >
                  {sortDir === 'asc' ? <ArrowUpAZ className="size-4" /> : <ArrowDownAZ className="size-4" />}
                </Button>
              }
            />
            <TooltipContent>
              {sortDir === 'asc' ? 'Sortert A-Å — klikk for Å-A' : 'Sortert Å-A — klikk for A-Å'}
            </TooltipContent>
          </Tooltip>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)} className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium">
            Legg til ansatt
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Ingen treff.</p>
        ) : (
          filtered.map((p) => (
            <Link
              key={p.id}
              href={`/people/${p.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-white dark:bg-white/5 p-3 transition-colors hover:bg-brand-cream/60 dark:hover:bg-white/10"
            >
              <Avatar className="size-11 ring-2 ring-transparent transition-all group-hover:ring-brand-orange/40">
                {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.full_name ?? ''} />}
                <AvatarFallback className="bg-brand-navy text-brand-orange">{getInitials(p.full_name || '?')}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.full_name || '—'}</p>
                <p className="text-xs text-muted-foreground truncate">{p.title || '—'}</p>
              </div>
              {isAdmin && (
                p.contractStatus === 'signed' ? (
                  <Badge className="bg-green-600 hover:bg-green-700">Kontrakt signert</Badge>
                ) : p.contractStatus === 'pending' ? (
                  <Badge variant="secondary">Kontrakt venter</Badge>
                ) : (
                  <Badge variant="outline" className="border-brand-orange/50 text-brand-navy dark:text-white">Mangler kontrakt</Badge>
                )
              )}
              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
            </Link>
          ))
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Legg til ansatt</DialogTitle>
            <DialogDescription>
              Sender en e-postinvitasjon der den ansatte kan sette sitt eget passord.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="flex flex-col gap-4">
            {inviteError && (
              <Alert variant="destructive">
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-name">Navn</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-email">E-post</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={inviting} className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium">
                {inviting ? 'Sender invitasjon...' : 'Send invitasjon'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
