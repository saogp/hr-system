'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination'
import { useToastManager } from '@/components/ui/toast'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoreHorizontal, ChevronRight, FileText, Download, Send, Search, Mail } from 'lucide-react'
import { ListPageSkeleton } from '@/components/ui/loading-skeletons'
import { IconBadge } from '@/components/ui/icon-badge'
import { fetchAndDownloadContractPdf } from '@/lib/contract-pdf'
import { FilterButton, FilterField, FilterChips } from '@/components/ui/filter-button'
import { MonthPicker } from '@/components/ui/month-picker'

type Template = {
  id: string
  name: string
  content: string
  created_at: string
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
  template_id: string | null
  profile_id: string
  company_id: string | null
  sent_to_accountant_at: string | null
  pdf_path: string | null
  contract_templates: { name: string } | null
  profiles: { full_name: string | null; email: string | null } | null
}

export default function ContractsPage() {
  const router = useRouter()
  const toastManager = useToastManager()
  const [role, setRole] = useState<'admin' | 'manager' | 'employee' | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'signed' | 'pending'>('all')
  const [page, setPage] = useState(1)

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

  useEffect(() => {
    setPage(1)
  }, [search, companyFilter, monthFilter, statusFilter])

  const handleDeleteContract = async () => {
    if (!deleteTargetId) return
    setDeleting(true)

    const { error } = await supabase.from('contracts').delete().eq('id', deleteTargetId)

    if (!error) {
      setContracts(prev => prev.filter(c => c.id !== deleteTargetId))
      setDeleteTargetId(null)
    } else {
      alert('Kunne ikke slette kontrakten.')
    }
    setDeleting(false)
  }

  const handleResendEmail = async (contractId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/contracts/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ contractId }),
    })
    if (res.ok) {
      toastManager.add({ title: 'E-post sendt på nytt' })
    } else {
      const result = await res.json().catch(() => ({}))
      toastManager.add({ title: 'Kunne ikke sende e-posten på nytt', description: result.error || 'Noe gikk galt.' })
    }
  }

  const handleSendToAccountant = async (contractId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/contracts/send-to-accountant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ contractId }),
    })

    if (!res.ok) {
      const result = await res.json().catch(() => ({}))
      alert(result.error || 'Kunne ikke sende til regnskapsfører.')
      return
    }

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

  const handleDownloadPdf = async (c: ContractRow) => {
    if (!c.template_id) {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/contracts/pdf-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ contractId: c.id }),
      })
      if (res.ok) {
        const { url } = await res.json()
        window.open(url, '_blank')
      } else {
        toastManager.add({ title: 'Kunne ikke hente PDF-en' })
      }
      return
    }
    fetchAndDownloadContractPdf(c.id)
  }

  const getStatusBadge = (c: ContractRow) => {
    if (!c.template_id) {
      return <Badge variant="secondary" className="w-fit">Historisk dokument</Badge>
    }

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
    return <ListPageSkeleton />
  }

  const filteredContracts = contracts.filter((c) => {
    if (search) {
      const name = (c.profiles?.full_name || c.profiles?.email || '').toLowerCase()
      const templateName = (c.contract_templates?.name || '').toLowerCase()
      if (!name.includes(search.toLowerCase()) && !templateName.includes(search.toLowerCase())) return false
    }
    if (companyFilter !== 'all' && c.company_id !== companyFilter) return false
    if (monthFilter && !c.sent_at.startsWith(monthFilter)) return false
    if (statusFilter !== 'all') {
      const signedCount = [c.employee_signed_at, c.admin_signed_at].filter(Boolean).length
      const isSigned = signedCount === 2
      if (statusFilter === 'signed' && !isSigned) return false
      if (statusFilter === 'pending' && isSigned) return false
    }
    return true
  })
  const activeFilterCount = [companyFilter !== 'all', !!monthFilter, statusFilter !== 'all'].filter(Boolean).length
  const totalPages = Math.max(1, Math.ceil(filteredContracts.length / PAGE_SIZE))
  const pagedContracts = filteredContracts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="max-w-[1440px] p-6 space-y-8">
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
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative sm:max-w-xs w-full">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Søk etter ansatt eller mal..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
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
                      { value: 'signed', label: 'Signert' },
                      { value: 'pending', label: 'Venter på signering' },
                    ]}
                  />
                </FilterField>
                <FilterField label="Måned sendt">
                  <MonthPicker value={monthFilter} onChange={setMonthFilter} />
                </FilterField>
                {activeFilterCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit self-start -mt-1"
                    onClick={() => { setCompanyFilter('all'); setStatusFilter('all'); setMonthFilter('') }}
                  >
                    Nullstill filter
                  </Button>
                )}
              </FilterButton>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => router.push('/contracts/upload')}
              >
                Last opp PDF
              </Button>
              <Button
                onClick={() => router.push('/contracts/new')}
                disabled={templates.length === 0}
                className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
              >
                Send kontrakt
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {filteredContracts.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Ingen kontrakter funnet.</p>
          ) : (
            pagedContracts.map((c) => {
              const rowContent = (
                <>
                  <div className="min-w-0 flex-1">
                    {isAdminLike(role) && (
                      <p className="font-medium text-base md:text-sm truncate">
                        {c.profiles?.full_name || c.profiles?.email || '—'}
                      </p>
                    )}
                    <p className={isAdminLike(role) ? 'text-xs text-muted-foreground truncate' : 'font-medium text-base md:text-sm truncate'}>
                      {c.template_id ? (c.contract_templates?.name || '—') : 'Opplastet arbeidsavtale'}
                    </p>
                    {c.company_id && (
                      <p className="text-xs text-muted-foreground truncate">
                        {companies.find((comp) => comp.id === c.company_id)?.name || '—'}
                      </p>
                    )}
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
                          <DropdownMenuItem onClick={() => handleDownloadPdf(c)}>
                            <Download />
                            Last ned som PDF
                          </DropdownMenuItem>
                          {isAdminLike(role) && c.template_id && !c.employee_signed_at && (
                            <DropdownMenuItem onClick={() => handleResendEmail(c.id)}>
                              <Mail />
                              Send e-post på nytt
                            </DropdownMenuItem>
                          )}
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
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white dark:bg-white/5 p-4 hover:bg-muted/50 cursor-pointer"
                >
                  {rowContent}
                </div>
              ) : (
                <Link
                  key={c.id}
                  href={`/contracts/${c.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white dark:bg-white/5 p-4 hover:bg-muted/50"
                >
                  {rowContent}
                </Link>
              )
            })
          )}
        </div>

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

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
