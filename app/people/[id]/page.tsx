'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type Company = { id: string; name: string }

type PersonProfile = {
  id: string
  email: string | null
  full_name: string | null
  title: string | null
  role: 'admin' | 'manager' | 'employee'
  birth_date: string | null
  manager_id: string | null
  phone: string | null
  interests: string | null
  fun_fact: string | null
}

type InviteStatus = {
  invited_at?: string
  confirmed_at?: string
  last_sign_in_at?: string
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [viewerId, setViewerId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [person, setPerson] = useState<PersonProfile | null>(null)
  const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string | null; email: string | null }[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyIds, setCompanyIds] = useState<string[]>([])
  const [inviteStatus, setInviteStatus] = useState<InviteStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const [editingSelf, setEditingSelf] = useState(false)
  const [phone, setPhone] = useState('')
  const [interests, setInterests] = useState('')
  const [funFact, setFunFact] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      setViewerId(user.id)

      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      const admin = viewerProfile?.role === 'admin'
      setIsAdmin(admin)

      if (admin) {
        const { data: fullData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', id)
          .single()

        if (!fullData) {
          router.replace('/people')
          return
        }
        setPerson(fullData)
        setPhone(fullData.phone ?? '')
        setInterests(fullData.interests ?? '')
        setFunFact(fullData.fun_fact ?? '')

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .order('full_name')
        if (profilesData) setAllProfiles(profilesData)

        const { data: companiesData } = await supabase.from('companies').select('*')
        if (companiesData) setCompanies(companiesData)

        const { data: pcData } = await supabase
          .from('profile_companies')
          .select('company_id')
          .eq('profile_id', id)
        if (pcData) setCompanyIds(pcData.map((r) => r.company_id))

        const { data: { session } } = await supabase.auth.getSession()
        const statusRes = await fetch('/api/employees', {
          headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        })
        if (statusRes.ok) {
          const { statuses } = await statusRes.json()
          setInviteStatus(statuses?.[id as string] ?? null)
        }
      } else {
        const { data } = await supabase.rpc('get_people_directory')
        const found = (data as PersonProfile[] | null)?.find((p) => p.id === id) ?? null

        if (!found) {
          router.replace('/people')
          return
        }
        setPerson(found)
        setPhone(found.phone ?? '')
        setInterests(found.interests ?? '')
        setFunFact(found.fun_fact ?? '')
      }

      setLoading(false)
    }

    load()
  }, [id, router])

  const isSelf = viewerId === id

  const handleSaveSelf = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ phone, interests, fun_fact: funFact })
      .eq('id', id)

    if (!error) {
      setPerson(prev => prev ? { ...prev, phone, interests, fun_fact: funFact } : prev)
      setEditingSelf(false)
    }
    setSaving(false)
  }

  const handleFieldChange = async (field: keyof PersonProfile, value: string | null) => {
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', id)
    if (!error) {
      setPerson(prev => prev ? { ...prev, [field]: value } : prev)
    }
  }

  const handleToggleCompany = async (companyId: string, checked: boolean) => {
    if (checked) {
      const { error } = await supabase
        .from('profile_companies')
        .insert({ profile_id: id, company_id: companyId })
      if (!error) setCompanyIds(prev => [...prev, companyId])
    } else {
      const { error } = await supabase
        .from('profile_companies')
        .delete()
        .eq('profile_id', id)
        .eq('company_id', companyId)
      if (!error) setCompanyIds(prev => prev.filter(c => c !== companyId))
    }
  }

  const handleResend = async () => {
    setResending(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/employees/${id}/resend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ redirectTo: `${window.location.origin}/onboarding` }),
    })

    if (!res.ok) {
      const result = await res.json().catch(() => ({}))
      alert(result.error || 'Kunne ikke sende invitasjon på nytt.')
    }
    setResending(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/employees/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })

    if (res.ok) {
      router.replace('/people')
    } else {
      const result = await res.json().catch(() => ({}))
      alert(result.error || 'Kunne ikke slette ansatt.')
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  if (loading || !person) {
    return <div className="p-8">Laster profil...</div>
  }

  const isPendingInvite = inviteStatus?.invited_at && !inviteStatus?.confirmed_at

  return (
    <div className="container mx-auto py-6 px-4 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/people"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Tilbake
        </Link>

        {isAdmin && !isSelf && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal />
                  <span className="sr-only">Handlinger</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {isPendingInvite && (
                <DropdownMenuItem disabled={resending} onClick={handleResend}>
                  {resending ? 'Sender...' : 'Send invitasjon på nytt'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                Slett
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex items-center gap-4 mb-8">
        <Avatar className="size-16">
          <AvatarFallback className="text-lg">{getInitials(person.full_name || '?')}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{person.full_name || '—'}</h1>
          <p className="text-muted-foreground text-sm">{person.title || '—'}</p>
        </div>
        {isAdmin && isPendingInvite && (
          <Tooltip>
            <TooltipTrigger render={<Badge variant="secondary" />}>Venter</TooltipTrigger>
            <TooltipContent>Invitert {formatDate(inviteStatus?.invited_at)}</TooltipContent>
          </Tooltip>
        )}
        {isAdmin && inviteStatus?.confirmed_at && (
          <Tooltip>
            <TooltipTrigger render={<Badge className="bg-green-600 hover:bg-green-700" />}>Aktiv</TooltipTrigger>
            <TooltipContent>Godkjent {formatDate(inviteStatus.confirmed_at)}</TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="space-y-8">
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">E-post</p>
            <p className="text-sm">{person.email || '—'}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Telefonnummer</p>
            {isSelf && editingSelf ? (
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            ) : (
              <p className="text-sm">{person.phone || '—'}</p>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Interesser</p>
            {isSelf && editingSelf ? (
              <Textarea value={interests} onChange={(e) => setInterests(e.target.value)} className="mt-1" />
            ) : (
              <p className="text-sm">{person.interests || '—'}</p>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Morsom fakta</p>
            {isSelf && editingSelf ? (
              <Textarea value={funFact} onChange={(e) => setFunFact(e.target.value)} className="mt-1" />
            ) : (
              <p className="text-sm">{person.fun_fact || '—'}</p>
            )}
          </div>

          {isSelf && (
            editingSelf ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveSelf} disabled={saving}>
                  {saving ? 'Lagrer...' : 'Lagre'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingSelf(false)}>
                  Avbryt
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditingSelf(true)}>
                Rediger min profil
              </Button>
            )
          )}
        </div>

        {isAdmin && (
          <div className="space-y-4 border-t border-border pt-6">
            <h2 className="font-medium">Administrer</h2>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="full_name">Navn</Label>
              <Input
                id="full_name"
                defaultValue={person.full_name ?? ''}
                onBlur={(e) => handleFieldChange('full_name', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                defaultValue={person.email ?? ''}
                onBlur={(e) => handleFieldChange('email', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Stilling</Label>
              <Input
                id="title"
                placeholder="F.eks. Designer, CTO, Prosjektleder"
                defaultValue={person.title ?? ''}
                onBlur={(e) => handleFieldChange('title', e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Rolle</Label>
              <Select
                value={person.role}
                onValueChange={(val) => val && handleFieldChange('role', val)}
              >
                <SelectTrigger className="w-full h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Leder</SelectItem>
                  <SelectItem value="employee">Ansatt</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Nærmeste leder</Label>
              <Select
                value={person.manager_id ?? 'none'}
                onValueChange={(val) => val && handleFieldChange('manager_id', val === 'none' ? null : val)}
              >
                <SelectTrigger className="w-full h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen</SelectItem>
                  {allProfiles
                    .filter((p) => p.id !== id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Bedrifter</Label>
              <div className="flex flex-col gap-2 rounded-md border border-input p-3">
                {companies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen bedrifter registrert enda.</p>
                ) : (
                  companies.map((c) => {
                    const checked = companyIds.includes(c.id)
                    const checkboxId = `company-${c.id}`
                    return (
                      <div key={c.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          id={checkboxId}
                          checked={checked}
                          onCheckedChange={(val) => handleToggleCompany(c.id, val === true)}
                        />
                        <Label htmlFor={checkboxId} className="font-normal">
                          {c.name}
                        </Label>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="birth_date">Bursdag</Label>
              <Input
                id="birth_date"
                type="date"
                defaultValue={person.birth_date ?? ''}
                onChange={(e) => handleFieldChange('birth_date', e.target.value || null)}
              />
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette {person.full_name || person.email || 'denne ansatte'} permanent,
              inkludert innloggingskontoen. Handlingen kan ikke angres.
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
