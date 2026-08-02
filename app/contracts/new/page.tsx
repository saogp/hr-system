'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getAdminTokens, extractChoiceFields, usesCompanyTokens } from '@/lib/contract-tokens'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { useToastManager } from '@/components/ui/toast'
import { ArrowLeft } from 'lucide-react'
import { FormPageSkeleton } from '@/components/ui/loading-skeletons'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Combobox, COMBOBOX_SEARCH_THRESHOLD } from '@/components/ui/combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'

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

export default function NewContractPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <NewContractPageInner />
    </Suspense>
  )
}

function NewContractPageInner() {
  const router = useRouter()
  const toastManager = useToastManager()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [profileCompanyMap, setProfileCompanyMap] = useState<Record<string, string[]>>({})

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [adminFieldValues, setAdminFieldValues] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)

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

      if (!isAdminLike(applyRoleOverride(profile?.role ?? 'employee'))) {
        router.replace('/contracts')
        return
      }

      setCurrentUserId(user.id)

      const [
        { data: templatesData },
        { data: employeesData },
        { data: companiesData },
        { data: pcData },
      ] = await Promise.all([
        supabase.from('contract_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email').order('full_name'),
        supabase.from('companies').select('*').order('name'),
        supabase.from('profile_companies').select('profile_id, company_id'),
      ])

      if (templatesData) {
        setTemplates(templatesData)
        const templateParam = searchParams.get('template')
        const preselected = templatesData.find((t) => t.id === templateParam)
        if (preselected) {
          setSelectedTemplateId(preselected.id)
          const defaults: Record<string, string> = {}
          for (const f of extractChoiceFields(preselected.content)) {
            defaults[f.key] = f.optionA
          }
          setAdminFieldValues(defaults)
        }
      }

      if (employeesData) setEmployees(employeesData)
      if (companiesData) setCompanies(companiesData)
      if (pcData) {
        const map: Record<string, string[]> = {}
        for (const row of pcData) {
          map[row.profile_id] = [...(map[row.profile_id] ?? []), row.company_id]
        }
        setProfileCompanyMap(map)
      }

      setLoading(false)
    }

    load()
  }, [router])

  const employeeCompanies = companies.filter((c) => (profileCompanyMap[selectedEmployeeId] ?? []).includes(c.id))

  useEffect(() => {
    setSelectedCompanyId(employeeCompanies.length === 1 ? employeeCompanies[0].id : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId])

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null
  const adminTokens = selectedTemplate ? getAdminTokens(selectedTemplate.content) : []
  const choiceFields = selectedTemplate ? extractChoiceFields(selectedTemplate.content) : []
  const needsCompany = selectedTemplate ? usesCompanyTokens(selectedTemplate.content) : false

  const handleSendContract = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    const { data, error } = await supabase.from('contracts').insert({
      template_id: selectedTemplateId,
      profile_id: selectedEmployeeId,
      company_id: needsCompany ? selectedCompanyId : null,
      admin_fields: adminFieldValues,
      created_by: currentUserId,
    }).select().single()

    if (!error && data) {
      const { data: { session } } = await supabase.auth.getSession()
      fetch('/api/contracts/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ contractId: data.id }),
      }).catch(() => {})

      toastManager.add({ title: 'Kontrakt sendt', description: 'Den ansatte kan nå signere kontrakten.' })
      router.push('/contracts')
      return
    }
    setSending(false)
  }

  if (loading) {
    return <FormPageSkeleton />
  }

  const cameFromTemplate = !!searchParams.get('template')

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href={cameFromTemplate ? '/settings' : '/contracts'}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        {cameFromTemplate ? 'Tilbake til innstillinger' : 'Tilbake til kontrakter'}
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy dark:text-white mb-1">Send kontrakt</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Velg ansatt og mal, og fyll inn det som er spesifikt for denne kontrakten.
      </p>

      <form onSubmit={handleSendContract} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Navn på ansatt</Label>
          {employees.length > COMBOBOX_SEARCH_THRESHOLD ? (
            <Combobox
              value={selectedEmployeeId}
              onValueChange={setSelectedEmployeeId}
              placeholder="Velg ansatt"
              options={employees.map((emp) => ({ value: emp.id, label: emp.full_name || emp.email || '' }))}
            />
          ) : (
            <Select value={selectedEmployeeId} onValueChange={(val) => val && setSelectedEmployeeId(val)}>
              <SelectTrigger className="w-full h-9">
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
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Hvilken mal vil du bruke?</Label>
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
            <SelectTrigger className="w-full h-9">
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
            <Label>Hvilken bedrift skal den ansatte jobbe for?</Label>
            <Select value={selectedCompanyId} onValueChange={(val) => val && setSelectedCompanyId(val)}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Velg bedrift" />
              </SelectTrigger>
              <SelectContent>
                {employeeCompanies.map((c) => (
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
            {token === 'tiltredelsesdato' ? (
              <DateInput
                id={`field-${token}`}
                value={adminFieldValues[token] ?? ''}
                onChange={(e) =>
                  setAdminFieldValues(prev => ({ ...prev, [token]: e.target.value }))
                }
                required
              />
            ) : (
              <Input
                id={`field-${token}`}
                type="text"
                value={adminFieldValues[token] ?? ''}
                onChange={(e) =>
                  setAdminFieldValues(prev => ({ ...prev, [token]: e.target.value }))
                }
                required
              />
            )}
          </div>
        ))}

        <Button
          type="submit"
          disabled={sending || !selectedEmployeeId || !selectedTemplateId || (needsCompany && !selectedCompanyId)}
          className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium w-fit"
        >
          {sending ? 'Sender...' : 'Send kontrakt'}
        </Button>
      </form>
    </div>
  )
}
