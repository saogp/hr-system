'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { getAdminTokens, extractChoiceFields, usesCompanyTokens } from '@/lib/contract-tokens'
import { POSITION_OPTIONS } from '@/lib/position-options'
import { useToastManager } from '@/components/ui/toast'
import { FormPageSkeleton } from '@/components/ui/loading-skeletons'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Combobox, COMBOBOX_SEARCH_THRESHOLD } from '@/components/ui/combobox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'

type Template = { id: string; name: string; content: string }
type Company = { id: string; name: string }
type ManagerOption = { id: string; full_name: string | null; email: string | null; role: string }

export default function NewEmployeePage() {
  const router = useRouter()
  const toastManager = useToastManager()
  const [loading, setLoading] = useState(true)

  const [templates, setTemplates] = useState<Template[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [managerOptions, setManagerOptions] = useState<ManagerOption[]>([])
  const [myCompanyIds, setMyCompanyIds] = useState<string[]>([])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [companyIds, setCompanyIds] = useState<string[]>([])
  const [companyEmployeeNumbers, setCompanyEmployeeNumbers] = useState<Record<string, string>>({})

  const [title, setTitle] = useState<string[]>([])
  const [role, setRole] = useState('employee')
  const [managerId, setManagerId] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [positionPercentage, setPositionPercentage] = useState('')
  const [startDate, setStartDate] = useState('')

  const [sendContract, setSendContract] = useState(false)
  const [contractTemplateId, setContractTemplateId] = useState('')
  const [contractCompanyId, setContractCompanyId] = useState('')
  const [contractAdminFields, setContractAdminFields] = useState<Record<string, string>>({})

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    async function load() {
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

      if (!isAdminLike(applyRoleOverride(viewerProfile?.role ?? 'employee'))) {
        router.replace('/people')
        return
      }

      const [
        { data: templatesData },
        { data: companiesData },
        { data: myCompanyLinks },
        { data: managersData },
      ] = await Promise.all([
        supabase.from('contract_templates').select('id, name, content').order('created_at', { ascending: false }),
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('profile_companies').select('company_id').eq('profile_id', user.id),
        supabase.from('profiles').select('id, full_name, email, role').in('role', ['admin', 'manager']).order('full_name'),
      ])

      if (templatesData) setTemplates(templatesData)
      if (companiesData) setCompanies(companiesData)
      if (myCompanyLinks) setMyCompanyIds(myCompanyLinks.map((r) => r.company_id))
      if (managersData) setManagerOptions(managersData)

      setLoading(false)
    }

    load()
  }, [router])

  const employeeCompanyOptions = myCompanyIds.length > 0 ? companies.filter((c) => myCompanyIds.includes(c.id)) : companies

  useEffect(() => {
    setContractCompanyId(companyIds.length === 1 ? companyIds[0] : '')
  }, [companyIds])

  const selectedTemplate = templates.find((t) => t.id === contractTemplateId) ?? null
  const contractAdminTokens = (selectedTemplate ? getAdminTokens(selectedTemplate.content) : []).filter((t) => t !== 'tiltredelsesdato')
  const contractChoiceFields = selectedTemplate ? extractChoiceFields(selectedTemplate.content) : []
  const contractNeedsCompany = selectedTemplate ? usesCompanyTokens(selectedTemplate.content) : false

  const toggleTitle = (option: string, checked: boolean) => {
    setTitle((prev) => (checked ? [...prev, option] : prev.filter((t) => t !== option)))
  }

  const toggleCompany = (companyId: string, companyName: string, checked: boolean) => {
    setCompanyIds((prev) => (checked ? [...prev, companyId] : prev.filter((id) => id !== companyId)))
    if (checked) {
      setCompanyEmployeeNumbers((prev) => {
        if (prev[companyId]) return prev
        const prefill = companyName.toLowerCase().includes('peppes') ? '318' : ''
        return prefill ? { ...prev, [companyId]: prefill } : prev
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError('')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ email, full_name: name }),
    })
    const result = await res.json()

    if (!res.ok) {
      setFormError(result.error || 'Noe gikk galt.')
      setSubmitting(false)
      return
    }

    const newProfileId: string | undefined = result.user?.id
    if (!newProfileId) {
      setFormError('Noe gikk galt under opprettelsen.')
      setSubmitting(false)
      return
    }

    if (companyIds.length > 0) {
      const { error: companyLinkError } = await supabase
        .from('profile_companies')
        .insert(companyIds.map((companyId) => ({
          profile_id: newProfileId,
          company_id: companyId,
          employee_number: companyEmployeeNumbers[companyId] ? Number(companyEmployeeNumbers[companyId]) : null,
        })))
      if (companyLinkError) {
        setFormError('Ansatt opprettet, men kunne ikke knytte bedrift. Legg til bedrift manuelt på profilen.')
        setSubmitting(false)
        router.push(`/people/${newProfileId}`)
        return
      }
    }

    await supabase
      .from('profiles')
      .update({
        title: title.length > 0 ? title.join(', ') : null,
        role,
        manager_id: managerId || null,
        employment_type: employmentType || null,
        position_percentage: positionPercentage ? Number(positionPercentage) : null,
        start_date: startDate || null,
      })
      .eq('id', newProfileId)

    if (sendContract && contractTemplateId) {
      await supabase.from('contracts').insert({
        template_id: contractTemplateId,
        profile_id: newProfileId,
        company_id: contractNeedsCompany ? contractCompanyId : null,
        admin_fields: { ...contractAdminFields, tiltredelsesdato: startDate },
      })
    }

    toastManager.add({ title: 'Ansatt lagt til', description: 'Invitasjon sendt på e-post.' })
    router.push('/people')
  }

  if (loading) {
    return <FormPageSkeleton />
  }

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href="/people"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Tilbake til ansatte
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy dark:text-white mb-6">Legg til ansatt</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-name">Navn</Label>
          <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-email">E-post</Label>
          <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Bedrift(er) og ansattnummer</Label>
          <div className="flex flex-col gap-2 rounded-md border border-input p-3">
            {employeeCompanyOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen bedrifter tilgjengelig.</p>
            ) : (
              employeeCompanyOptions.map((c) => {
                const checkboxId = `new-employee-company-${c.id}`
                const checked = companyIds.includes(c.id)
                return (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      onCheckedChange={(val) => toggleCompany(c.id, c.name, val === true)}
                    />
                    <Label htmlFor={checkboxId} className="font-normal flex-1">{c.name}</Label>
                    <Input
                      type="number"
                      placeholder="Ansattnr."
                      className="w-28 h-8 shrink-0"
                      disabled={!checked}
                      value={companyEmployeeNumbers[c.id] ?? ''}
                      onChange={(e) => setCompanyEmployeeNumbers((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    />
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="rounded-md border border-input p-4 space-y-4">
          <h2 className="font-medium text-sm">Arbeid</h2>

          <div className="flex flex-col gap-1.5">
            <Label>Stilling</Label>
            <div className="flex flex-col gap-2 rounded-md border border-input p-3">
              {POSITION_OPTIONS.map((option) => {
                const checkboxId = `new-title-${option}`
                return (
                  <div key={option} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={checkboxId}
                      checked={title.includes(option)}
                      onCheckedChange={(val) => toggleTitle(option, val === true)}
                    />
                    <Label htmlFor={checkboxId} className="font-normal">{option}</Label>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Rolle</Label>
            <RadioGroup value={role} onValueChange={(val) => val && setRole(val)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="admin" id="new-role-admin" />
                <Label htmlFor="new-role-admin" className="font-normal">Admin</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="manager" id="new-role-manager" />
                <Label htmlFor="new-role-manager" className="font-normal">Leder</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="employee" id="new-role-employee" />
                <Label htmlFor="new-role-employee" className="font-normal">Ansatt</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Nærmeste leder</Label>
            {managerOptions.length > COMBOBOX_SEARCH_THRESHOLD ? (
              <Combobox
                value={managerId}
                onValueChange={setManagerId}
                placeholder="Velg leder"
                options={managerOptions.map((m) => ({ value: m.id, label: m.full_name || m.email || '' }))}
              />
            ) : (
              <Select value={managerId} onValueChange={(val) => val && setManagerId(val)}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Velg leder" />
                </SelectTrigger>
                <SelectContent>
                  {managerOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Ansettelsesforhold</Label>
            <RadioGroup value={employmentType} onValueChange={(val) => val && setEmploymentType(val)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fast" id="new-employment-fast" />
                <Label htmlFor="new-employment-fast" className="font-normal">Fast</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="tilkalling" id="new-employment-tilkalling" />
                <Label htmlFor="new-employment-tilkalling" className="font-normal">Tilkalling</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-position-percentage">Stillingsprosent</Label>
            <Input
              id="new-position-percentage"
              type="number"
              min={0}
              max={100}
              value={positionPercentage}
              onChange={(e) => setPositionPercentage(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-start-date">Tiltredelse</Label>
            <DateInput id="new-start-date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
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
          <div className="flex flex-col gap-4 rounded-md border border-input p-4">
            <div className="flex flex-col gap-1.5">
              <Label>Mal</Label>
              <Select
                value={contractTemplateId}
                onValueChange={(val) => {
                  if (!val) return
                  setContractTemplateId(val)
                  const template = templates.find((t) => t.id === val)
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
                  onValueChange={(val) => setContractAdminFields((prev) => ({ ...prev, [f.key]: val }))}
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
                  onChange={(e) => setContractAdminFields((prev) => ({ ...prev, [token]: e.target.value }))}
                  required
                />
              </div>
            ))}
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting || companyIds.length === 0}
          className="w-fit bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
        >
          {submitting ? 'Sender invitasjon...' : 'Send invitasjon'}
        </Button>
      </form>
    </div>
  )
}
