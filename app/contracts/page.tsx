'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getAdminTokens, extractChoiceFields, usesCompanyTokens } from '@/lib/contract-tokens'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MoreHorizontal } from 'lucide-react'

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

      const currentRole = profile?.role ?? 'employee'
      setRole(currentRole)

      if (currentRole === 'admin') {
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
    if (role === 'admin') {
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

  return (
    <div className="container mx-auto py-10 px-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Kontrakter</h1>
        <p className="text-muted-foreground text-sm">
          {role === 'admin'
            ? 'Send kontrakter til ansatte.'
            : 'Dine kontrakter.'}
        </p>
      </div>

      <div>
        <div className="flex flex-row items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {role === 'admin' ? 'Alle kontrakter' : 'Mine kontrakter'}
          </h2>
          {role === 'admin' && (
            <Button onClick={() => setSendOpen(true)} disabled={templates.length === 0}>
              Send kontrakt
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {role === 'admin' && <TableHead>Ansatt</TableHead>}
              <TableHead>Mal</TableHead>
              <TableHead>Sendt</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Handling</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={role === 'admin' ? 5 : 4} className="text-center text-muted-foreground py-8">
                  Ingen kontrakter registrert enda.
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((c) => (
                <TableRow key={c.id}>
                  {role === 'admin' && (
                    <TableCell className="font-medium">
                      {c.profiles?.full_name || c.profiles?.email || '—'}
                    </TableCell>
                  )}
                  <TableCell>{c.contract_templates?.name || '—'}</TableCell>
                  <TableCell>{formatDate(c.sent_at)}</TableCell>
                  <TableCell>{getStatusBadge(c)}</TableCell>
                  <TableCell className="text-right">
                    {role === 'admin' ? (
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
                          <DropdownMenuItem onClick={() => router.push(`/contracts/${c.id}`)}>
                            Åpne
                          </DropdownMenuItem>
                          {!c.employee_signed_at && !c.admin_signed_at && (
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargetId(c.id)}>
                              Slett
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button variant="ghost" size="sm" render={<Link href={`/contracts/${c.id}`} />}>
                        Åpne
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
                <Select
                  value={adminFieldValues[f.key] ?? f.optionA}
                  onValueChange={(val) => val && setAdminFieldValues(prev => ({ ...prev, [f.key]: val }))}
                >
                  <SelectTrigger className="w-full h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={f.optionA}>{f.optionA}</SelectItem>
                    <SelectItem value={f.optionB}>{f.optionB}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}

            {adminTokens.map((token) => (
              <div key={token} className="flex flex-col gap-1.5">
                <Label htmlFor={`field-${token}`} className="capitalize">{token}</Label>
                <Input
                  id={`field-${token}`}
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
