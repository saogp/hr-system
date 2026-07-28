'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MoreHorizontal, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { IconBadge } from '@/components/ui/icon-badge'
import { applyRoleOverride } from '@/lib/role-override'
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

type Company = { id: string; name: string }

type PersonContract = {
  id: string
  sent_at: string
  employee_signed_at: string | null
  admin_signed_at: string | null
  contract_templates: { name: string } | null
}

type PersonProfile = {
  id: string
  email: string | null
  full_name: string | null
  title: string | null
  role: 'admin' | 'manager' | 'employee'
  birth_date: string | null
  manager_id: string | null
  phone: string | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  employee_number: number | null
  employment_type: 'fast' | 'tilkalling' | null
  position_percentage: number | null
  start_date: string | null
  end_date: string | null
  next_review_date: string | null
}

type DirectoryProfile = {
  id: string
  full_name: string | null
  title: string | null
  role: string
  email: string | null
  phone: string | null
  employee_number: number | null
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
  'birth_date',
  'emergency_contact_name',
  'emergency_contact_phone',
]

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
  const [directoryPerson, setDirectoryPerson] = useState<DirectoryProfile | null>(null)
  const [allProfiles, setAllProfiles] = useState<{ id: string; full_name: string | null; email: string | null }[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyIds, setCompanyIds] = useState<string[]>([])
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
      const admin = applyRoleOverride(viewerProfile?.role ?? 'employee') === 'admin'
      setIsAdmin(admin)

      const viewingSelf = user.id === id

      if (admin || viewingSelf) {
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

        if (admin) {
          const { data: contractsData } = await supabase
            .from('contracts')
            .select('id, sent_at, employee_signed_at, admin_signed_at, contract_templates!contracts_template_id_fkey(name)')
            .eq('profile_id', id)
            .order('sent_at', { ascending: false })
          if (contractsData) setContracts(contractsData as unknown as PersonContract[])

          const { data: { session } } = await supabase.auth.getSession()
          const statusRes = await fetch('/api/employees', {
            headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
          })
          if (statusRes.ok) {
            const { statuses } = await statusRes.json()
            setInviteStatus(statuses?.[id as string] ?? null)
          }
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

  const isSelf = viewerId === id

  const handleFieldChange = async (field: keyof PersonProfile, value: string | number | null) => {
    const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', id)
    if (!error) {
      setPerson(prev => prev ? { ...prev, [field]: value } : prev)
    }
  }

  const canEditField = (field: keyof PersonProfile) =>
    isAdmin || (isSelf && SELF_EDITABLE_FIELDS.includes(field))

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
    inputType: 'text' | 'email' | 'number' | 'date' = 'text'
  ) => {
    const editable = editing && canEditField(field)
    const commit = (raw: string) =>
      handleFieldChange(field, inputType === 'number' ? (raw ? Number(raw) : null) : (raw || null))

    return (
      <div className="py-3" key={field}>
        <Label htmlFor={field} className="text-xs text-muted-foreground mb-1">{label}</Label>
        {editable ? (
          <Input
            id={field}
            type={inputType}
            min={inputType === 'number' ? 0 : undefined}
            max={inputType === 'number' ? 100 : undefined}
            defaultValue={rawValue ?? ''}
            onBlur={inputType !== 'date' ? (e) => commit(e.target.value) : undefined}
            onChange={inputType === 'date' ? (e) => commit(e.target.value) : undefined}
          />
        ) : (
          <p className="text-sm">{display}</p>
        )}
      </div>
    )
  }

  if (loading) {
    return <div className="p-8">Laster profil...</div>
  }

  const isDirectoryOnly = !isAdmin && !isSelf

  if (isDirectoryOnly) {
    if (!directoryPerson) {
      return <div className="p-8">Laster profil...</div>
    }

    return (
      <div className="container mx-auto py-6 px-4 max-w-2xl">
        <Link
          href="/people"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-4" />
          Tilbake
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <Avatar className="size-16">
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
            <p className="text-sm">{directoryPerson.email || '—'}</p>
          </div>
          <div className="py-3">
            <p className="text-xs text-muted-foreground">Telefonnummer</p>
            <p className="text-sm">{directoryPerson.phone || '—'}</p>
          </div>
          <div className="py-3">
            <p className="text-xs text-muted-foreground">Ansattnummer</p>
            <p className="text-sm">{directoryPerson.employee_number ?? '—'}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!person) {
    return <div className="p-8">Laster profil...</div>
  }

  const isPendingInvite = inviteStatus?.invited_at && !inviteStatus?.confirmed_at
  const canEditSomething = isAdmin || isSelf

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
          <AvatarFallback className="text-lg bg-brand-navy text-brand-orange">{getInitials(person.full_name || '?')}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-brand-navy dark:text-white">{person.full_name || '—'}</h1>
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
            variant={editing ? 'outline' : 'default'}
            className={editing ? '' : 'bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium'}
            onClick={() => setEditing(v => !v)}
          >
            {editing ? 'Ferdig' : 'Rediger'}
          </Button>
        </div>
      )}

      <div className="divide-y divide-border border-t border-border">
        {renderRow('Navn', 'full_name', person.full_name, person.full_name || '—', 'text')}
        {renderRow('E-post', 'email', person.email, person.email || '—', 'email')}
        {renderRow('Telefonnummer', 'phone', person.phone, person.phone || '—', 'text')}
        {renderRow('Adresse', 'address', person.address, person.address || '—', 'text')}

        <div className="py-3">
          <p className="text-xs text-muted-foreground mb-1">Nærmeste pårørende</p>
          {editing && canEditField('emergency_contact_name') ? (
            <div className="flex gap-2">
              <Input
                placeholder="Navn"
                defaultValue={person.emergency_contact_name ?? ''}
                onBlur={(e) => handleFieldChange('emergency_contact_name', e.target.value || null)}
              />
              <Input
                placeholder="Telefon"
                defaultValue={person.emergency_contact_phone ?? ''}
                onBlur={(e) => handleFieldChange('emergency_contact_phone', e.target.value || null)}
              />
            </div>
          ) : (
            <p className="text-sm">
              {person.emergency_contact_name || person.emergency_contact_phone
                ? `${person.emergency_contact_name || '—'}${person.emergency_contact_phone ? ' · ' + person.emergency_contact_phone : ''}`
                : '—'}
            </p>
          )}
        </div>

        <div className="py-3">
          <p className="text-xs text-muted-foreground">Ansattnummer</p>
          <p className="text-sm">{person.employee_number ?? '—'}</p>
        </div>

        {renderRow('Stilling', 'title', person.title, person.title || '—', 'text')}

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
          ) : (
            <p className="text-sm">
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
            <p className="text-sm">
              {person.employment_type === 'fast' ? 'Fast' : person.employment_type === 'tilkalling' ? 'Tilkalling' : '—'}
            </p>
          )}
        </div>

        {renderRow(
          'Stillingsprosent',
          'position_percentage',
          person.position_percentage,
          person.position_percentage != null ? `${person.position_percentage} %` : '—',
          'number'
        )}
        {renderRow('Tiltredelse', 'start_date', person.start_date, person.start_date ? formatDate(person.start_date) : '—', 'date')}
        {renderRow('Sluttdato', 'end_date', person.end_date, person.end_date ? formatDate(person.end_date) : '—', 'date')}
        {renderRow('Bursdag', 'birth_date', person.birth_date, person.birth_date ? formatDate(person.birth_date) : '—', 'date')}
        {renderRow(
          'Neste medarbeidersamtale',
          'next_review_date',
          person.next_review_date,
          person.next_review_date ? formatDate(person.next_review_date) : '—',
          'date'
        )}

        <div className="py-3">
          <p className="text-xs text-muted-foreground mb-1">Bedrifter</p>
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
                      <Label htmlFor={checkboxId} className="font-normal">
                        {c.name}
                      </Label>
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <p className="text-sm">
              {companies.filter((c) => companyIds.includes(c.id)).map((c) => c.name).join(', ') || '—'}
            </p>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="space-y-2 border-t border-border pt-4 mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-2">
              <IconBadge icon={<FileText className="size-4" />} />
              Kontrakter
            </p>
            <Button size="sm" variant="outline" render={<Link href="/contracts" />}>
              Send kontrakt
            </Button>
          </div>
          {contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen kontrakter enda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border rounded-md border border-input">
              {contracts.map((c) => {
                const signedCount = [c.employee_signed_at, c.admin_signed_at].filter(Boolean).length
                const isUnsigned = signedCount === 0
                return (
                  <div key={c.id} className="flex items-center justify-between gap-2 p-1 pl-3">
                    <Link
                      href={`/contracts/${c.id}`}
                      className="min-w-0 flex-1 py-2 rounded-md hover:bg-muted/50"
                    >
                      <p className="text-sm font-medium truncate">{c.contract_templates?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">Sendt {formatDate(c.sent_at)}</p>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      {signedCount === 2 ? (
                        <Badge className="bg-green-600 hover:bg-green-700">2 av 2 signert</Badge>
                      ) : (
                        <Badge variant="secondary">{signedCount} av 2 signert</Badge>
                      )}
                      {isUnsigned && (
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
        </div>
      )}

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
