'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MoreHorizontal, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ProfilePageSkeleton } from '@/components/ui/loading-skeletons'
import { IconBadge } from '@/components/ui/icon-badge'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { logAudit } from '@/lib/audit-log'
import { POSITION_OPTIONS } from '@/lib/position-options'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PhoneInput } from '@/components/phone-input'

type Company = { id: string; name: string }

type PersonContract = {
  id: string
  sent_at: string
  employee_signed_at: string | null
  admin_signed_at: string | null
  template_id: string | null
  contract_templates: { name: string } | null
}

type PersonProfile = {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  title: string | null
  role: 'admin' | 'manager' | 'employee'
  birth_date: string | null
  manager_id: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  postal_place: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  employee_number: number | null
  employment_type: 'fast' | 'tilkalling' | null
  position_percentage: number | null
  start_date: string | null
  end_date: string | null
  next_review_date: string | null
  is_active: boolean
}

type DirectoryProfile = {
  id: string
  full_name: string | null
  title: string | null
  role: string
  email: string | null
  phone: string | null
  employee_number: number | null
  avatar_url: string | null
}

type InviteStatus = {
  invited_at?: string
  confirmed_at?: string
  last_sign_in_at?: string
}

const SELF_EDITABLE_FIELDS: (keyof PersonProfile)[] = [
  'email',
  'phone',
  'address',
  'postal_code',
  'postal_place',
  'birth_date',
  'emergency_contact_name',
  'emergency_contact_phone',
]

function getInitials(name: string) {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? ''
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export default function PersonDetailPage() {
  return (
    <Suspense fallback={<ProfilePageSkeleton />}>
      <PersonDetailPageInner />
    </Suspense>
  )
}

function PersonDetailPageInner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [viewerId, setViewerId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isRealAdmin, setIsRealAdmin] = useState(false)
  const [person, setPerson] = useState<PersonProfile | null>(null)
  const [directoryPerson, setDirectoryPerson] = useState<DirectoryProfile | null>(null)
  const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string | null; email: string | null; role: string }[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyIds, setCompanyIds] = useState<string[]>([])
  const [companyEmployeeNumbers, setCompanyEmployeeNumbers] = useState<Record<string, string>>({})
  const [inviteStatus, setInviteStatus] = useState<InviteStatus | null>(null)
  const [contracts, setContracts] = useState<PersonContract[]>([])
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [resending, setResending] = useState(false)
  const [contractDeleteId, setContractDeleteId] = useState<string | null>(null)
  const [deletingContract, setDeletingContract] = useState(false)

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
      const viewerRole = applyRoleOverride(viewerProfile?.role ?? 'employee')
      const admin = isAdminLike(viewerRole)
      setIsAdmin(admin)
      setIsRealAdmin(viewerRole === 'admin')

      const viewingSelf = user.id === id

      if (admin || viewingSelf) {
        const statusPromise = admin
          ? supabase.auth.getSession().then(({ data: { session } }) =>
              fetch('/api/employees', { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } })
                .then((res) => (res.ok ? res.json() : null))
                .catch(() => null)
            )
          : Promise.resolve(null)

        const [
          { data: fullData },
          { data: profilesData },
          { data: companiesData },
          { data: pcData },
          { data: contractsData },
          statusResult,
        ] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', id).single(),
          supabase.from('profiles').select('id, full_name, email, role').order('full_name'),
          supabase.from('companies').select('*'),
          supabase.from('profile_companies').select('company_id, employee_number').eq('profile_id', id),
          admin
            ? supabase
                .from('contracts')
                .select('id, sent_at, employee_signed_at, admin_signed_at, template_id, contract_templates!contracts_template_id_fkey(name)')
                .eq('profile_id', id)
                .order('sent_at', { ascending: false })
            : Promise.resolve({ data: null }),
          statusPromise,
        ])

        if (!fullData) {
          router.replace('/people')
          return
        }
        setPerson(fullData)
        if (profilesData) setAllProfiles(profilesData)
        if (companiesData) setCompanies(companiesData)
        if (pcData) {
          setCompanyIds(pcData.map((r) => r.company_id))
          const numMap: Record<string, string> = {}
          for (const r of pcData) {
            if (r.employee_number != null) numMap[r.company_id] = String(r.employee_number)
          }
          setCompanyEmployeeNumbers(numMap)
        }
        if (admin) {
          if (contractsData) setContracts(contractsData as unknown as PersonContract[])
          if (statusResult) setInviteStatus(statusResult.statuses?.[id as string] ?? null)
        }
      } else {
        const { data } = await supabase.rpc('get_people_directory')
        const found = (data as DirectoryProfile[] | null)?.find((p) => p.id === id) ?? null

        if (!found) {
          router.replace('/people')
          return
        }
        setDirectoryPerson(found)
      }

      setLoading(false)
    }

    load()
  }, [id, router])

  useEffect(() => {
    if (!person) return
    const wantsEdit = searchParams.get('edit') === '1'
    if (wantsEdit && (isAdmin || viewerId === id)) {
      setEditing(true)
    }
  }, [person, isAdmin, viewerId, id, searchParams])

  const isSelf = viewerId === id

  const handleFieldChange = async (field: keyof PersonProfile, value: string | number | null) => {
    const oldValue = person?.[field] ?? null
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', id)
    if (!error) {
      setPerson(prev => prev ? { ...prev, [field]: value } : prev)
      if (viewerId && viewerId !== id) {
        logAudit(viewerId, 'profile_field_updated', id, { field, old_value: oldValue, new_value: value, target_name: person?.full_name ?? person?.email })
      }
    }
  }

  const canEditField = (field: keyof PersonProfile) =>
    isAdmin || (isSelf && SELF_EDITABLE_FIELDS.includes(field))

  const handleToggleCompany = async (companyId: string, checked: boolean) => {
    const companyName = companies.find((c) => c.id === companyId)?.name
    if (checked) {
      const prefillNumber = companyName?.toLowerCase().includes('peppes') ? '318' : ''
      const { error } = await supabase
        .from('profile_companies')
        .insert({
          profile_id: id,
          company_id: companyId,
          employee_number: prefillNumber ? Number(prefillNumber) : null,
        })
      if (!error) {
        setCompanyIds(prev => [...prev, companyId])
        if (prefillNumber) setCompanyEmployeeNumbers(prev => ({ ...prev, [companyId]: prefillNumber }))
        if (viewerId) logAudit(viewerId, 'company_assigned', id, { company_name: companyName, target_name: person?.full_name ?? person?.email })
      }
    } else {
      const { error } = await supabase
        .from('profile_companies')
        .delete()
        .eq('profile_id', id)
        .eq('company_id', companyId)
      if (!error) {
        setCompanyIds(prev => prev.filter(c => c !== companyId))
        setCompanyEmployeeNumbers(prev => {
          const next = { ...prev }
          delete next[companyId]
          return next
        })
        if (viewerId) logAudit(viewerId, 'company_removed', id, { company_name: companyName, target_name: person?.full_name ?? person?.email })
      }
    }
  }

  const handleCompanyEmployeeNumberChange = async (companyId: string, value: string) => {
    setCompanyEmployeeNumbers(prev => ({ ...prev, [companyId]: value }))
    await supabase
      .from('profile_companies')
      .update({ employee_number: value ? Number(value) : null })
      .eq('profile_id', id)
      .eq('company_id', companyId)
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
    })

    if (!res.ok) {
      const result = await res.json().catch(() => ({}))
      alert(result.error || 'Kunne ikke sende invitasjon på nytt.')
    }
    setResending(false)
  }

  const handleToggleActive = async () => {
    if (!person) return
    const nextActive = !person.is_active
    const { error } = await supabase.from('profiles').update({ is_active: nextActive }).eq('id', id)
    if (!error) {
      setPerson(prev => prev ? { ...prev, is_active: nextActive } : prev)
    }
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

  const handleDeleteContract = async () => {
    if (!contractDeleteId) return
    setDeletingContract(true)

    const { error } = await supabase.from('contracts').delete().eq('id', contractDeleteId)

    if (!error) {
      setContracts(prev => prev.filter(c => c.id !== contractDeleteId))
      setContractDeleteId(null)
    }
    setDeletingContract(false)
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-red-500 hover:bg-red-600">Admin</Badge>
      case 'manager':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Leder</Badge>
      default:
        return <Badge variant="secondary">Ansatt</Badge>
    }
  }

  const renderRow = (
    label: string,
    field: keyof PersonProfile,
    rawValue: string | number | null,
    display: string,
    inputType: 'text' | 'email' | 'number' | 'date' = 'text',
    numberRange?: { min: number; max: number },
    noPadding?: boolean
  ) => {
    const editable = editing && canEditField(field)
    const commit = (raw: string) =>
      handleFieldChange(field, inputType === 'number' ? (raw ? Number(raw) : null) : (raw || null))

    return (
      <div className={noPadding ? '' : 'py-3'} key={field}>
        <Label htmlFor={field} className="text-xs text-muted-foreground mb-1">{label}</Label>
        {editable ? (
          <Input
            id={field}
            type={inputType}
            min={inputType === 'number' ? numberRange?.min : undefined}
            max={inputType === 'number' ? numberRange?.max : undefined}
            defaultValue={rawValue ?? ''}
            onBlur={inputType !== 'date' ? (e) => commit(e.target.value) : undefined}
            onChange={inputType === 'date' ? (e) => commit(e.target.value) : undefined}
          />
        ) : (
          <p className="text-base md:text-sm">{display}</p>
        )}
      </div>
    )
  }

  if (loading) {
    return <ProfilePageSkeleton />
  }

  const isDirectoryOnly = !isAdmin && !isSelf

  if (isDirectoryOnly) {
    if (!directoryPerson) {
      return <ProfilePageSkeleton />
    }

    return (
      <div className="p-6 max-w-[1440px]">
        <Link
          href="/people"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-4" />
          Tilbake
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <Avatar className="size-16">
            {directoryPerson.avatar_url && <AvatarImage src={directoryPerson.avatar_url} alt={directoryPerson.full_name ?? ''} />}
            <AvatarFallback className="text-lg bg-brand-navy text-brand-orange">{getInitials(directoryPerson.full_name || '?')}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-brand-navy dark:text-white">{directoryPerson.full_name || '—'}</h1>
            <p className="text-muted-foreground text-sm">{directoryPerson.title || '—'}</p>
          </div>
        </div>

        <div className="divide-y divide-border border-t border-border">
          <div className="py-3">
            <p className="text-xs text-muted-foreground">E-post</p>
            <p className="text-base md:text-sm">{directoryPerson.email || '—'}</p>
          </div>
          <div className="py-3">
            <p className="text-xs text-muted-foreground">Telefonnummer</p>
            <p className="text-base md:text-sm">{directoryPerson.phone || '—'}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!person) {
    return <ProfilePageSkeleton />
  }

  const isPendingInvite = inviteStatus?.invited_at && !inviteStatus?.confirmed_at
  const canEditSomething = isAdmin || isSelf

  return (
    <div className="py-6 px-4 max-w-[1440px]">
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
                <Button variant="ghost" size="icon">
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
              <DropdownMenuItem onClick={handleToggleActive}>
                {person.is_active ? 'Deaktiver' : 'Aktiver'}
              </DropdownMenuItem>
              {isRealAdmin && (
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Slett
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex items-center gap-4 mb-8">
        <Avatar className="size-16">
          {person.avatar_url && <AvatarImage src={person.avatar_url} alt={person.full_name ?? ''} />}
          <AvatarFallback className="text-lg bg-brand-navy text-brand-orange">{getInitials(person.full_name || '?')}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
            {person.full_name || '—'}
            {!person.is_active && <Badge variant="secondary">Inaktiv</Badge>}
          </h1>
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

      {canEditSomething && (
        <div className="flex justify-end mb-2">
          <Button
            size="sm"
            variant={editing ? 'default' : 'outline'}
            className={editing ? 'bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium' : ''}
            onClick={() => setEditing(v => !v)}
          >
            {editing ? 'Lagre' : 'Rediger'}
          </Button>
        </div>
      )}

      <div className={isAdmin ? 'grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start' : 'flex flex-col gap-6'}>
        <Card className="shadow-none border-border py-0 rounded-2xl lg:col-start-1 lg:row-start-1">
          <CardHeader className="border-b border-border py-4">
            <CardTitle className="text-sm font-semibold">Generell info</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="divide-y divide-border">
              {renderRow('Navn', 'full_name', person.full_name, person.full_name || '—', 'text')}
              {renderRow('E-post', 'email', person.email, person.email || '—', 'email')}

              <div className="py-3">
                <Label className="text-xs text-muted-foreground mb-1">Telefonnummer</Label>
                {editing && canEditField('phone') ? (
                  <PhoneInput
                    value={person.phone}
                    onCommit={(val) => handleFieldChange('phone', val)}
                  />
                ) : (
                  <p className="text-base md:text-sm">{person.phone || '—'}</p>
                )}
              </div>

              {renderRow('Adresse', 'address', person.address, person.address || '—', 'text')}

              <div className="py-3">
                <Label className="text-xs text-muted-foreground mb-1">Postnummer / poststed</Label>
                {editing && canEditField('postal_code') ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Postnr."
                      className="w-24 shrink-0"
                      defaultValue={person.postal_code ?? ''}
                      onBlur={(e) => handleFieldChange('postal_code', e.target.value || null)}
                    />
                    <Input
                      placeholder="Poststed"
                      defaultValue={person.postal_place ?? ''}
                      onBlur={(e) => handleFieldChange('postal_place', e.target.value || null)}
                    />
                  </div>
                ) : (
                  <p className="text-base md:text-sm">
                    {person.postal_code || person.postal_place
                      ? `${person.postal_code || ''} ${person.postal_place || ''}`.trim()
                      : '—'}
                  </p>
                )}
              </div>

              {renderRow('Bursdag', 'birth_date', person.birth_date, person.birth_date ? formatDate(person.birth_date) : '—', 'date')}

              <div className="py-3">
                <p className="text-xs text-muted-foreground mb-1">Nærmeste pårørende</p>
                {editing && canEditField('emergency_contact_name') ? (
                  <div className="flex flex-col gap-2">
                    <Input
                      placeholder="Navn"
                      defaultValue={person.emergency_contact_name ?? ''}
                      onBlur={(e) => handleFieldChange('emergency_contact_name', e.target.value || null)}
                    />
                    <PhoneInput
                      value={person.emergency_contact_phone}
                      onCommit={(val) => handleFieldChange('emergency_contact_phone', val)}
                    />
                  </div>
                ) : (
                  <p className="text-base md:text-sm">
                    {person.emergency_contact_name || person.emergency_contact_phone
                      ? `${person.emergency_contact_name || '—'}${person.emergency_contact_phone ? ' · ' + person.emergency_contact_phone : ''}`
                      : '—'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="shadow-none border-border py-0 rounded-2xl lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <CardHeader className="border-b border-border py-4 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <IconBadge icon={<FileText className="size-4" />} />
                Dokumenter
              </CardTitle>
              <Button size="sm" variant="outline" render={<Link href="/contracts" />}>
                Send kontrakt
              </Button>
            </CardHeader>
            <CardContent className="px-4">
              {contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">Ingen kontrakter enda.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {contracts.map((c) => {
                    const signedCount = [c.employee_signed_at, c.admin_signed_at].filter(Boolean).length
                    const isUnsigned = signedCount === 0
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-2 py-1">
                        <Link
                          href={`/contracts/${c.id}`}
                          className="min-w-0 flex-1 py-2 rounded-md hover:bg-muted/50"
                        >
                          <p className="text-base md:text-sm font-medium truncate">
                            {c.template_id ? (c.contract_templates?.name || '—') : 'Opplastet arbeidsavtale'}
                          </p>
                          <p className="text-xs text-muted-foreground">Sendt {formatDate(c.sent_at)}</p>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0">
                          {c.template_id && (
                            signedCount === 2 ? (
                              <Badge className="bg-green-600 hover:bg-green-700">2 av 2 signert</Badge>
                            ) : (
                              <Badge variant="secondary">{signedCount} av 2 signert</Badge>
                            )
                          )}
                          {isUnsigned && isRealAdmin && (
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
                                <DropdownMenuItem variant="destructive" onClick={() => setContractDeleteId(c.id)}>
                                  Slett
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-none border-border py-0 rounded-2xl lg:col-start-1 lg:row-start-2">
          <CardHeader className="border-b border-border py-4">
            <CardTitle className="text-sm font-semibold">Arbeid</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="divide-y divide-border">
              <div className="py-3">
                <p className="text-xs text-muted-foreground mb-1">Stilling</p>
                {editing && isAdmin ? (
                  <div className="flex flex-col gap-2 rounded-md border border-input p-3">
                    {POSITION_OPTIONS.map((option) => {
                      const selected = (person.title ?? '').split(',').map((s) => s.trim()).filter(Boolean)
                      const checked = selected.includes(option)
                      const checkboxId = `title-${option}`
                      return (
                        <div key={option} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            id={checkboxId}
                            checked={checked}
                            onCheckedChange={(val) => {
                              const next = val === true
                                ? [...selected, option]
                                : selected.filter((s) => s !== option)
                              handleFieldChange('title', next.length > 0 ? next.join(', ') : null)
                            }}
                          />
                          <Label htmlFor={checkboxId} className="font-normal">{option}</Label>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-base md:text-sm">{person.title || '—'}</p>
                )}
              </div>

              <div className="py-3">
                <p className="text-xs text-muted-foreground mb-1">Rolle</p>
                {editing && isAdmin ? (
                  <RadioGroup value={person.role} onValueChange={(val) => handleFieldChange('role', val)}>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="admin" id="role-admin" />
                      <Label htmlFor="role-admin" className="font-normal">Admin</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="manager" id="role-manager" />
                      <Label htmlFor="role-manager" className="font-normal">Leder</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="employee" id="role-employee" />
                      <Label htmlFor="role-employee" className="font-normal">Ansatt</Label>
                    </div>
                  </RadioGroup>
                ) : (
                  getRoleBadge(person.role)
                )}
              </div>

              <div className="py-3">
                <p className="text-xs text-muted-foreground mb-1">Nærmeste leder</p>
                {editing && isAdmin ? (
                  <Select
                    value={person.manager_id ?? 'none'}
                    onValueChange={(val) => val && handleFieldChange('manager_id', val === 'none' ? null : val)}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen</SelectItem>
                      {allProfiles
                        .filter((p) => p.id !== id && (p.role === 'admin' || p.role === 'manager'))
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name || p.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-base md:text-sm">
                    {allProfiles.find((p) => p.id === person.manager_id)?.full_name || 'Ingen'}
                  </p>
                )}
              </div>

              <div className="py-3">
                <p className="text-xs text-muted-foreground mb-1">Ansettelsesforhold</p>
                {editing && isAdmin ? (
                  <RadioGroup
                    value={person.employment_type ?? 'none'}
                    onValueChange={(val) => handleFieldChange('employment_type', val === 'none' ? null : val)}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="none" id="employment-none" />
                      <Label htmlFor="employment-none" className="font-normal">Ikke satt</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="fast" id="employment-fast" />
                      <Label htmlFor="employment-fast" className="font-normal">Fast</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="tilkalling" id="employment-tilkalling" />
                      <Label htmlFor="employment-tilkalling" className="font-normal">Tilkalling</Label>
                    </div>
                  </RadioGroup>
                ) : (
                  <p className="text-base md:text-sm">
                    {person.employment_type === 'fast' ? 'Fast' : person.employment_type === 'tilkalling' ? 'Tilkalling' : '—'}
                  </p>
                )}
              </div>

              {renderRow(
                'Stillingsprosent',
                'position_percentage',
                person.position_percentage,
                person.position_percentage != null ? `${person.position_percentage} %` : '—',
                'number',
                { min: 0, max: 100 }
              )}
              <div className="py-3 grid grid-cols-2 gap-4">
                {renderRow('Tiltredelse', 'start_date', person.start_date, person.start_date ? formatDate(person.start_date) : '—', 'date', undefined, true)}
                {renderRow('Sluttdato', 'end_date', person.end_date, person.end_date ? formatDate(person.end_date) : '—', 'date', undefined, true)}
              </div>
              {renderRow(
                'Neste medarbeidersamtale',
                'next_review_date',
                person.next_review_date,
                person.next_review_date ? formatDate(person.next_review_date) : '—',
                'date'
              )}

              <div className="py-3">
                <p className="text-xs text-muted-foreground mb-1">Bedrifter og ansattnummer</p>
                {editing && isAdmin ? (
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
                            <Label htmlFor={checkboxId} className="font-normal flex-1">
                              {c.name}
                            </Label>
                            <Input
                              type="number"
                              placeholder="Ansattnr."
                              className="w-28 h-8 shrink-0"
                              disabled={!checked}
                              value={companyEmployeeNumbers[c.id] ?? ''}
                              onChange={(e) => handleCompanyEmployeeNumberChange(c.id, e.target.value)}
                            />
                          </div>
                        )
                      })
                    )}
                  </div>
                ) : (
                  <p className="text-base md:text-sm">
                    {companies.filter((c) => companyIds.includes(c.id)).map((c) =>
                      companyEmployeeNumbers[c.id] ? `${c.name} (${companyEmployeeNumbers[c.id]})` : c.name
                    ).join(', ') || '—'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
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

      <AlertDialog open={contractDeleteId !== null} onOpenChange={(open) => !open && setContractDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette kontrakten permanent. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deletingContract}
              onClick={handleDeleteContract}
            >
              {deletingContract ? 'Sletter...' : 'Slett'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
