'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

type Person = {
  id: string
  full_name: string | null
  title: string | null
  role: string
  email: string | null
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
    setIsAdmin(viewerProfile?.role === 'admin')

    const { data } = await supabase.rpc('get_people_directory')
    if (data) setPeople(data)
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
        redirectTo: `${window.location.origin}/onboarding`,
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

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ansatte</h1>
        <p className="text-muted-foreground text-sm">Oversikt over alle ansatte.</p>
      </div>

      <div className="flex flex-row items-center justify-between gap-4 mb-4">
        <div className="flex flex-row items-center gap-3">
          <Input
            placeholder="Finn person..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={sortDir} onValueChange={(val) => val && setSortDir(val as 'asc' | 'desc')}>
            <SelectTrigger className="w-56 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Sorter etter navn (A-Å)</SelectItem>
              <SelectItem value="desc">Sorter etter navn (Å-A)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)}>Legg til ansatt</Button>
        )}
      </div>

      <div className="flex flex-col divide-y divide-border border-t border-border">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Ingen treff.</p>
        ) : (
          filtered.map((p) => (
            <Link
              key={p.id}
              href={`/people/${p.id}`}
              className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-md hover:bg-muted/50"
            >
              <Avatar className="size-10">
                <AvatarFallback>{getInitials(p.full_name || '?')}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{p.full_name || '—'}</p>
                <p className="text-xs text-muted-foreground">{p.title || '—'}</p>
              </div>
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
              <Button type="submit" disabled={inviting}>
                {inviting ? 'Sender invitasjon...' : 'Send invitasjon'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
