'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowUpAZ, ArrowDownAZ, Users, Search } from 'lucide-react'
import { ListPageSkeleton } from '@/components/ui/loading-skeletons'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ChevronRight } from 'lucide-react'
import { getAdminTokens, extractChoiceFields, usesCompanyTokens } from '@/lib/contract-tokens'
import { UNIFORM_TYPES, UNIFORM_SIZES, needsCardCredentials } from '@/lib/uniform-items'
import { useToastManager } from '@/components/ui/toast'
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination'

type Person = {
  id: string
  full_name: string | null
  title: string | null
  role: string
  email: string | null
  end_date: string | null
  contractStatus: 'signed' | 'pending' | 'none'
  avatar_url: string | null
  is_active: boolean
}

type Template = {
  id: string
  name: string
  content: string
}

type Company = {
  id: string
  name: string
}

type UniformRow = { type: string; size: string; quantity: number; cardNumber: string; cardPassword: string }

const emptyUniformRow = (): UniformRow => ({ type: UNIFORM_TYPES[0], size: 'Ingen', quantity: 1, cardNumber: '', cardPassword: '' })

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
  const toastManager = useToastManager()
  const [people, setPeople] = useState<Person[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showInactive, setShowInactive] = useState(false)
  const [page, setPage] = useState(1)

  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

  const [templates, setTemplates] = useState<Template[]>([])
  const [companies, setCompanies] = useState<Company[]>([])

  const [sendContract, setSendContract] = useState(false)
  const [contractTemplateId, setContractTemplateId] = useState('')
  const [contractCompanyId, setContractCompanyId] = useState('')
  const [contractAdminFields, setContractAdminFields] = useState<Record<string, string>>({})

  const [sendUniform, setSendUniform] = useState(false)
  const [uniformRows, setUniformRows] = useState<UniformRow[]>([emptyUniformRow()])
  const [uniformSendEmail, setUniformSendEmail] = useState(false)

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
        .select('id, full_name, title, role, email, end_date, avatar_url, is_active')
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

      const { data: templatesData } = await supabase
        .from('contract_templates')
        .select('id, name, content')
        .order('created_at', { ascending: false })
      if (templatesData) setTemplates(templatesData)

      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .order('name')
      if (companiesData) setCompanies(companiesData)
    } else {
      const { data } = await supabase.rpc('get_people_directory')
      if (data) setPeople(data.map((p: Person) => ({ ...p, end_date: null, contractStatus: 'none', is_active: true })))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [search, showInactive])

  const selectedTemplate = templates.find(t => t.id === contractTemplateId) ?? null
  const contractAdminTokens = selectedTemplate ? getAdminTokens(selectedTemplate.content) : []
  const contractChoiceFields = selectedTemplate ? extractChoiceFields(selectedTemplate.content) : []
  const contractNeedsCompany = selectedTemplate ? usesCompanyTokens(selectedTemplate.content) : false

  const updateUniformRow = (index: number, patch: Partial<UniformRow>) => {
    setUniformRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const resetAddForm = () => {
    setNewName('')
    setNewEmail('')
    setSendContract(false)
    setContractTemplateId('')
    setContractCompanyId('')
    setContractAdminFields({})
    setSendUniform(false)
    setUniformRows([emptyUniformRow()])
    setUniformSendEmail(false)
  }

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
      setInviting(false)
      return
    }

    const newProfileId: string | undefined = result.user?.id

    if (newProfileId && sendContract && contractTemplateId) {
      await supabase.from('contracts').insert({
        template_id: contractTemplateId,
        profile_id: newProfileId,
        company_id: contractNeedsCompany ? contractCompanyId : null,
        admin_fields: contractAdminFields,
      })
    }

    if (newProfileId && sendUniform && uniformRows.length > 0) {
      await fetch('/api/uniform-issuance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          profileId: newProfileId,
          items: uniformRows,
          sendEmail: uniformSendEmail,
        }),
      })
    }

    setAddOpen(false)
    resetAddForm()
    load()
    setInviting(false)
    toastManager.add({ title: 'Ansatt lagt til', description: 'Invitasjon sendt på e-post.' })
  }

  if (loading) {
    return <ListPageSkeleton />
  }

  const filtered = people
    .filter((p) => (showInactive ? !p.is_active : p.is_active))
    .filter((p) => (p.full_name ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const cmp = (a.full_name ?? '').localeCompare(b.full_name ?? '', 'no')
      return sortDir === 'asc' ? cmp : -cmp
    })
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
              className="pl-8"
            />
          </div>
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
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={showInactive ? 'default' : 'outline'}
              className={showInactive ? 'bg-brand-navy text-white hover:bg-brand-navy/90' : ''}
              onClick={() => setShowInactive((v) => !v)}
            >
              {showInactive ? 'Aktive ansatte' : 'Inaktive ansatte'}
            </Button>
            <Button onClick={() => setAddOpen(true)} className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium">
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
              className={`group flex items-center gap-3 rounded-2xl border border-border bg-white dark:bg-white/5 p-3 transition-colors hover:bg-brand-cream/60 dark:hover:bg-white/10 ${!p.is_active ? 'opacity-60' : ''}`}
            >
              <Avatar className="size-11 ring-2 ring-transparent transition-all group-hover:ring-brand-orange/40">
                {p.avatar_url && <AvatarImage src={p.avatar_url} alt={p.full_name ?? ''} />}
                <AvatarFallback className="bg-brand-navy text-brand-orange">{getInitials(p.full_name || '?')}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-base md:text-sm truncate">{p.full_name || '—'}</p>
                <p className="text-xs text-muted-foreground truncate">{p.title || '—'}</p>
              </div>
              {!p.is_active ? (
                <Badge variant="secondary">Inaktiv</Badge>
              ) : isAdmin && (
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

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetAddForm() }}>
        <DialogContent className="max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Legg til ansatt</DialogTitle>
            <DialogDescription>
              Sender en e-postinvitasjon der den ansatte kan sette sitt eget passord.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="flex flex-col gap-4 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto -mx-4 px-4 flex flex-col gap-4">
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

              <div className="flex items-center gap-2">
                <Checkbox
                  id="send-contract"
                  checked={sendContract}
                  onCheckedChange={(val) => setSendContract(val === true)}
                />
                <Label htmlFor="send-contract" className="font-normal">
                  Send arbeidskontrakt samtidig
                </Label>
              </div>

              {sendContract && (
                <div className="flex flex-col gap-4 rounded-md border border-input p-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Mal</Label>
                    <Select
                      value={contractTemplateId}
                      onValueChange={(val) => {
                        if (!val) return
                        setContractTemplateId(val)
                        const template = templates.find(t => t.id === val)
                        const defaults: Record<string, string> = {}
                        if (template) {
                          for (const f of extractChoiceFields(template.content)) {
                            defaults[f.key] = f.optionA
                          }
                        }
                        setContractAdminFields(defaults)
                      }}
                    >
                      <SelectTrigger className="w-full h-9">
                        <SelectValue placeholder="Velg mal" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {contractNeedsCompany && (
                    <div className="flex flex-col gap-1.5">
                      <Label>Bedrift</Label>
                      <Select value={contractCompanyId} onValueChange={(val) => val && setContractCompanyId(val)}>
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="Velg bedrift" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {contractChoiceFields.map((f) => (
                    <div key={f.key} className="flex flex-col gap-1.5">
                      <Label className="capitalize">{f.key}</Label>
                      <RadioGroup
                        value={contractAdminFields[f.key] ?? f.optionA}
                        onValueChange={(val) => setContractAdminFields(prev => ({ ...prev, [f.key]: val }))}
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value={f.optionA} id={`new-choice-${f.key}-a`} />
                          <Label htmlFor={`new-choice-${f.key}-a`} className="font-normal">{f.optionA}</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value={f.optionB} id={`new-choice-${f.key}-b`} />
                          <Label htmlFor={`new-choice-${f.key}-b`} className="font-normal">{f.optionB}</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  ))}

                  {contractAdminTokens.map((token) => (
                    <div key={token} className="flex flex-col gap-1.5">
                      <Label htmlFor={`new-field-${token}`} className="capitalize">{token}</Label>
                      <Input
                        id={`new-field-${token}`}
                        type={token === 'tiltredelsesdato' ? 'date' : 'text'}
                        value={contractAdminFields[token] ?? ''}
                        onChange={(e) => setContractAdminFields(prev => ({ ...prev, [token]: e.target.value }))}
                        required
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Checkbox
                  id="send-uniform"
                  checked={sendUniform}
                  onCheckedChange={(val) => setSendUniform(val === true)}
                />
                <Label htmlFor="send-uniform" className="font-normal">
                  Send uniform/utstyr samtidig
                </Label>
              </div>

              {sendUniform && (
                <div className="flex flex-col gap-3 rounded-md border border-input p-3">
                  {uniformRows.map((row, i) => {
                    const isCard = needsCardCredentials(row.type)
                    return (
                      <div key={i} className="flex items-center gap-2 flex-wrap">
                        <Select value={row.type} onValueChange={(val) => val && updateUniformRow(i, { type: val })}>
                          <SelectTrigger className="w-36 h-9 shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIFORM_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isCard ? (
                          <>
                            <Input
                              placeholder="Kortnummer"
                              value={row.cardNumber}
                              onChange={(e) => updateUniformRow(i, { cardNumber: e.target.value })}
                              className="w-32 h-9 shrink-0"
                            />
                            <Input
                              placeholder="Passord/kode"
                              value={row.cardPassword}
                              onChange={(e) => updateUniformRow(i, { cardPassword: e.target.value })}
                              className="w-32 h-9 shrink-0"
                            />
                          </>
                        ) : (
                          <>
                            <Select value={row.size} onValueChange={(val) => val && updateUniformRow(i, { size: val })}>
                              <SelectTrigger className="w-24 h-9 shrink-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {UNIFORM_SIZES.map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) => updateUniformRow(i, { quantity: Math.max(1, Number(e.target.value)) })}
                              className="w-16 h-9 shrink-0"
                            />
                          </>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setUniformRows(prev => prev.filter((_, idx) => idx !== i))}
                          disabled={uniformRows.length === 1}
                        >
                          Fjern
                        </Button>
                      </div>
                    )
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => setUniformRows(prev => [...prev, emptyUniformRow()])}
                  >
                    + Legg til utstyr
                  </Button>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="uniform-send-email"
                      checked={uniformSendEmail}
                      onCheckedChange={(val) => setUniformSendEmail(val === true)}
                    />
                    <Label htmlFor="uniform-send-email" className="font-normal">
                      Send e-post og be om signatur
                    </Label>
                  </div>
                </div>
              )}
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
