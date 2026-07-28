'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getAdminTokens, extractChoiceFields, usesCompanyTokens } from '@/lib/contract-tokens'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoreHorizontal, ChevronRight, FileText, Download, Send } from 'lucide-react'
import { IconBadge } from '@/components/ui/icon-badge'
import { fetchAndDownloadContractPdf } from '@/lib/contract-pdf'

type Template = {
  id: string
  name: string
  content: string
  created_at: string
}

type EmployeeOption = {
  id: string
  full_name: string | null
  email: string | null
}

type Company = {
  id: string
  name: string
  org_number: string | null
  billing_address: string | null
}

type ContractRow = {
  id: string
  sent_at: string
  employee_signed_at: string | null
  admin_signed_at: string | null
  admin_fields: Record<string, string>
  template_id: string
  profile_id: string
  company_id: string | null
  sent_to_accountant_at: string | null
  contract_templates: { name: string } | null
  profiles: { full_name: string | null; email: string | null } | null
}

export default function ContractsPage() {
  const router = useRouter()
  const [role, setRole] = useState<'admin' | 'manager' | 'employee' | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)

  const [sendOpen, setSendOpen] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [adminFieldValues, setAdminFieldValues] = useState<Record<string, string>>({})
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const currentRole = applyRoleOverride(profile?.role ?? 'employee') as 'admin' | 'manager' | 'employee'
      setRole(currentRole)

      if (isAdminLike(currentRole)) {
        const { data: templatesData } = await supabase
          .from('contract_templates')
          .select('*')
          .order('created_at', { ascending: false })
        if (templatesData) setTemplates(templatesData)

        const { data: employeesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .order('full_name')
        if (employeesData) setEmployees(employeesData)

        const { data: companiesData } = await supabase
          .from('companies')
          .select('*')
          .order('name')
        if (companiesData) setCompanies(companiesData)

        const { data: contractsData } = await supabase
          .from('contracts')
          .select('*, contract_templates!contracts_template_id_fkey(name), profiles!contracts_profile_id_fkey(full_name, email)')
          .order('sent_at', { ascending: false })
        if (contractsData) setContracts(contractsData as unknown as ContractRow[])
      } else {
        const { data: contractsData } = await supabase
          .from('contracts')
          .select('*, contract_templates!contracts_template_id_fkey(name)')
          .eq('profile_id', user.id)
          .order('sent_at', { ascending: false })
        if (contractsData) setContracts(contractsData as unknown as ContractRow[])
      }

      setLoading(false)
    }

    load()
  }, [router])

  const refetchContracts = async () => {
    if (isAdminLike(role)) {
      const { data } = await supabase
        .from('contracts')
        .select('*, contract_templates!contracts_template_id_fkey(name), profiles!contracts_profile_id_fkey(full_name, email)')
        .order('sent_at', { ascending: false })
      if (data) setContracts(data as unknown as ContractRow[])
    }
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null
  const adminTokens = selectedTemplate ? getAdminTokens(selectedTemplate.content) : []
  const choiceFields = selectedTemplate ? extractChoiceFields(selectedTemplate.content) : []
  const needsCompany = selectedTemplate ? usesCompanyTokens(selectedTemplate.content) : false

  const handleSendContract = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('contracts').insert({
      template_id: selectedTemplateId,
      profile_id: selectedEmployeeId,
      company_id: needsCompany ? selectedCompanyId : null,
      admin_fields: adminFieldValues,
    })

    if (!error) {
      setSendOpen(false)
      setSelectedEmployeeId('')
      setSelectedTemplateId('')
      setSelectedCompanyId('')
      setAdminFieldValues({})
      refetchContracts()
    }
  }

  const handleDeleteContract = async () => {
    if (!deleteTargetId) return
    setDeleting(true)

    const { error } = await supabase.from('contracts').delete().eq('id', deleteTargetId)

    if (!error) {
      setContracts(prev => prev.filter(c => c.id !== deleteTargetId))
      setDeleteTargetId(null)
    }
    setDeleting(false)
  }

  const handleSendToAccountant = async (contractId: string) => {
    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('contracts')
      .update({ sent_to_accountant_at: nowIso })
      .eq('id', contractId)
    if (!error) {
      setContracts(prev => prev.map(c => c.id === contractId ? { ...c, sent_to_accountant_at: nowIso } : c))
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  const getStatusBadge = (c: ContractRow) => {
    const signedCount = [c.employee_signed_at, c.admin_signed_at].filter(Boolean).length

    if (signedCount === 2) {
      return (
        <Tooltip>
          <TooltipTrigger render={<Badge className="bg-green-600 hover:bg-green-700 w-fit" />}>
            2 av 2 signert
          </TooltipTrigger>
          <TooltipContent>
            Ansatt signert {formatDate(c.employee_signed_at!)}, ansvarlig signert {formatDate(c.admin_signed_at!)}
          </TooltipContent>
        </Tooltip>
      )
    }

    return <Badge variant="secondary" className="w-fit">{signedCount} av 2 signert</Badge>
  }

  if (loading) {
    return <div className="p-8">Laster kontrakter...</div>
  }

  const filteredContracts = contracts.filter((c) => {
    if (search) {
      const name = (c.profiles?.full_name || c.profiles?.email || '').toLowerCase()
      const templateName = (c.contract_templates?.name || '').toLowerCase()
      if (!name.includes(search.toLowerCase()) && !templateName.includes(search.toLowerCase())) return false
    }
    if (companyFilter !== 'all' && c.company_id !== companyFilter) return false
    if (monthFilter && !c.sent_at.startsWith(monthFilter)) return false
    return true
  })

  return (
    <div className="max-w-4xl py-10 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
          <IconBadge icon={<FileText className="size-4" />} />
          Kontrakter
        </h1>
        <p className="text-muted-foreground text-sm">
          {isAdminLike(role)
            ? 'Send kontrakter til ansatte.'
            : 'Dine kontrakter.'}
        </p>
      </div>

      <div>
        {isAdminLike(role) && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Søk etter ansatt eller mal..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sm:max-w-xs"
              />
              <Select value={companyFilter} onValueChange={(val) => val && setCompanyFilter(val)}>
                <SelectTrigger className="w-full sm:w-48 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle restauranter</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <Button
              onClick={() => setSendOpen(true)}
              disabled={templates.length === 0}
              className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium shrink-0"
            >
              Send kontrakt
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {filteredContracts.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Ingen kontrakter funnet.</p>
          ) : (
            filteredContracts.map((c) => {
              const rowContent = (
                <>
                  <div className="min-w-0 flex-1">
                    {isAdminLike(role) && (
                      <p className="font-medium text-base md:text-sm truncate">
                        {c.profiles?.full_name || c.profiles?.email || '—'}
                      </p>
                    )}
                    <p className={isAdminLike(role) ? 'text-xs text-muted-foreground truncate' : 'font-medium text-base md:text-sm truncate'}>
                      {c.contract_templates?.name || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">Sendt {formatDate(c.sent_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {getStatusBadge(c)}
                    <div onClick={(e) => e.stopPropagation()}>
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
                          <DropdownMenuItem onClick={() => fetchAndDownloadContractPdf(c.id)}>
                            <Download />
                            Last ned som PDF
                          </DropdownMenuItem>
                          {isAdminLike(role) && (
                            <DropdownMenuItem onClick={() => handleSendToAccountant(c.id)}>
                              <Send />
                              Send til regnskapsfører
                            </DropdownMenuItem>
                          )}
                          {role === 'admin' && (
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargetId(c.id)}>
                              Slett
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {!isAdminLike(role) && <ChevronRight className="size-4 text-muted-foreground" />}
                  </div>
                </>
              )

              return isAdminLike(role) ? (
                <div
                  key={c.id}
                  onClick={() => router.push(`/contracts/${c.id}`)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 hover:bg-muted/50 cursor-pointer"
                >
                  {rowContent}
                </div>
              ) : (
                <Link
                  key={c.id}
                  href={`/contracts/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 hover:bg-muted/50"
                >
                  {rowContent}
                </Link>
              )
            })
          )}
        </div>
      </div>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send kontrakt</DialogTitle>
            <DialogDescription>
              Velg ansatt og mal, og fyll inn det som er spesifikt for denne kontrakten.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendContract} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Ansatt</Label>
              <Select value={selectedEmployeeId} onValueChange={(val) => val && setSelectedEmployeeId(val)}>
                <SelectTrigger className="w-full h-8">
                  <SelectValue placeholder="Velg ansatt" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name || emp.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Mal</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={(val) => {
                  if (val) {
                    setSelectedTemplateId(val)
                    const template = templates.find(t => t.id === val)
                    const defaults: Record<string, string> = {}
                    if (template) {
                      for (const f of extractChoiceFields(template.content)) {
                        defaults[f.key] = f.optionA
                      }
                    }
                    setAdminFieldValues(defaults)
                  }
                }}
              >
                <SelectTrigger className="w-full h-8">
                  <SelectValue placeholder="Velg mal" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsCompany && (
              <div className="flex flex-col gap-1.5">
                <Label>Bedrift</Label>
                <Select value={selectedCompanyId} onValueChange={(val) => val && setSelectedCompanyId(val)}>
                  <SelectTrigger className="w-full h-8">
                    <SelectValue placeholder="Velg bedrift" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {choiceFields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <Label className="capitalize">{f.key}</Label>
                <RadioGroup
                  value={adminFieldValues[f.key] ?? f.optionA}
                  onValueChange={(val) => setAdminFieldValues(prev => ({ ...prev, [f.key]: val }))}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={f.optionA} id={`choice-${f.key}-a`} />
                    <Label htmlFor={`choice-${f.key}-a`} className="font-normal">{f.optionA}</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={f.optionB} id={`choice-${f.key}-b`} />
                    <Label htmlFor={`choice-${f.key}-b`} className="font-normal">{f.optionB}</Label>
                  </div>
                </RadioGroup>
              </div>
            ))}

            {adminTokens.map((token) => (
              <div key={token} className="flex flex-col gap-1.5">
                <Label htmlFor={`field-${token}`} className="capitalize">{token}</Label>
                <Input
                  id={`field-${token}`}
                  type={token === 'tiltredelsesdato' ? 'date' : 'text'}
                  value={adminFieldValues[token] ?? ''}
                  onChange={(e) =>
                    setAdminFieldValues(prev => ({ ...prev, [token]: e.target.value }))
                  }
                  required
                />
              </div>
            ))}

            <DialogFooter>
              <Button
                type="submit"
                disabled={!selectedEmployeeId || !selectedTemplateId || (needsCompany && !selectedCompanyId)}
                className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
              >
                Send kontrakt
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
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
              disabled={deleting}
              onClick={handleDeleteContract}
            >
              {deleting ? 'Sletter...' : 'Slett'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
