'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { sendPushNotification } from '@/lib/push-client'
import { UNIFORM_TYPES, UNIFORM_SIZES, needsCardCredentials } from '@/lib/uniform-items'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Person = { id: string; full_name: string | null; email: string | null }
type Company = { id: string; name: string }
type Row = { type: string; size: string; quantity: number; cardNumber: string; cardPassword: string }

const emptyRow = (): Row => ({ type: UNIFORM_TYPES[0], size: 'Ingen', quantity: 1, cardNumber: '', cardPassword: '' })

export default function NewUniformIssuancePage() {
  const router = useRouter()
  const toastManager = useToastManager()
  const [loading, setLoading] = useState(true)
  const [people, setPeople] = useState<Person[]>([])

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [profileCompanyMap, setProfileCompanyMap] = useState<Record<string, string[]>>({})
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [sendEmail, setSendEmail] = useState(false)
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
        router.replace('/uniformer')
        return
      }

      const [{ data: peopleData }, { data: companiesData }, { data: pcData }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').order('full_name'),
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('profile_companies').select('profile_id, company_id'),
      ])
      if (peopleData) setPeople(peopleData)
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

  const employeeCompanies = (profileCompanyMap[selectedEmployeeId] ?? [])
    .map((cid) => companies.find((c) => c.id === cid))
    .filter((c): c is Company => !!c)

  useEffect(() => {
    if (employeeCompanies.length === 1) {
      setSelectedCompanyId(employeeCompanies[0].id)
    } else {
      setSelectedCompanyId('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId])

  const updateRow = (index: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const addRow = () => {
    setRows(prev => [...prev, emptyRow()])
  }

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    if (!selectedEmployeeId) {
      setFormError('Velg en ansatt.')
      return
    }
    if (employeeCompanies.length > 1 && !selectedCompanyId) {
      setFormError('Denne ansatte jobber hos flere bedrifter — velg hvilken bedrift utleveringen gjelder.')
      return
    }
    if (rows.length === 0) {
      setFormError('Legg til minst ett utstyr.')
      return
    }

    setSubmitting(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const res = await fetch('/api/uniform-issuance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        profileId: selectedEmployeeId,
        companyId: selectedCompanyId || null,
        items: rows,
        sendEmail,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      setFormError(result.error || 'Noe gikk galt.')
      setSubmitting(false)
      return
    }

    await sendPushNotification(
      selectedEmployeeId,
      'Nytt personalutstyr',
      'Du har fått utlevert utstyr. Bekreft mottak.',
      `/uniformer/${result.issuance.id}`
    )

    toastManager.add({ title: 'Utlevering registrert', description: 'Utstyret er registrert.' })
    router.push('/uniformer')
  }

  if (loading) {
    return <FormPageSkeleton />
  }

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href="/uniformer"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Tilbake til personalutstyr
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy dark:text-white mb-6">Ny registrering</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Ansatt</Label>
          {people.length > COMBOBOX_SEARCH_THRESHOLD ? (
            <Combobox
              value={selectedEmployeeId}
              onValueChange={setSelectedEmployeeId}
              placeholder="Velg ansatt"
              options={people.map((p) => ({ value: p.id, label: p.full_name || p.email || '' }))}
            />
          ) : (
            <Select value={selectedEmployeeId} onValueChange={(val) => val && setSelectedEmployeeId(val)}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Velg ansatt" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {employeeCompanies.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label>Bedrift</Label>
            <Select value={selectedCompanyId} onValueChange={(val) => val && setSelectedCompanyId(val)}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Velg bedrift" />
              </SelectTrigger>
              <SelectContent>
                {employeeCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>Utstyr</Label>
          {rows.map((row, i) => {
            const isCard = needsCardCredentials(row.type)
            return (
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <Select value={row.type} onValueChange={(val) => val && updateRow(i, { type: val })}>
                  <SelectTrigger className="w-40 h-9 shrink-0">
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
                      onChange={(e) => updateRow(i, { cardNumber: e.target.value })}
                      className="w-36 h-9 shrink-0"
                    />
                    <Input
                      placeholder="Passord/kode"
                      value={row.cardPassword}
                      onChange={(e) => updateRow(i, { cardPassword: e.target.value })}
                      className="w-36 h-9 shrink-0"
                    />
                  </>
                ) : (
                  <>
                    <Select value={row.size} onValueChange={(val) => val && updateRow(i, { size: val })}>
                      <SelectTrigger className="w-28 h-9 shrink-0">
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
                      onChange={(e) => updateRow(i, { quantity: Math.max(1, Number(e.target.value)) })}
                      className="w-20 h-9 shrink-0"
                    />
                  </>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                >
                  Fjern
                </Button>
              </div>
            )
          })}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addRow}>
            + Legg til utstyr
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="send-email"
            checked={sendEmail}
            onCheckedChange={(val) => setSendEmail(val === true)}
          />
          <Label htmlFor="send-email" className="font-normal">
            Send e-post og be om signatur
          </Label>
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}

        <Button
          type="submit"
          disabled={submitting}
          className="w-fit bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
        >
          {submitting ? 'Registrerer...' : 'Registrer'}
        </Button>
      </form>
    </div>
  )
}
