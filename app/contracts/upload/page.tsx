'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
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
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'

type EmployeeOption = {
  id: string
  full_name: string | null
  email: string | null
}

type Company = {
  id: string
  name: string
}

export default function UploadContractPage() {
  const router = useRouter()
  const toastManager = useToastManager()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [companies, setCompanies] = useState<Company[]>([])

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [signedDate, setSignedDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

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

      const { data: employeesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name')
      if (employeesData) setEmployees(employeesData)

      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .order('name')
      if (companiesData) setCompanies(companiesData)

      setLoading(false)
    }

    load()
  }, [router])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedEmployeeId || !file) return
    setUploading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    const formData = new FormData()
    formData.append('profileId', selectedEmployeeId)
    if (selectedCompanyId) formData.append('companyId', selectedCompanyId)
    if (signedDate) formData.append('signedDate', signedDate)
    formData.append('pdf', file)

    const res = await fetch('/api/contracts/upload-pdf', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: formData,
    })

    if (res.ok) {
      toastManager.add({ title: 'Kontrakt lastet opp' })
      router.push('/contracts')
      return
    }

    const result = await res.json().catch(() => ({}))
    setError(result.error || 'Kunne ikke laste opp kontrakten.')
    setUploading(false)
  }

  if (loading) {
    return <FormPageSkeleton />
  }

  return (
    <div className="p-6 max-w-[1440px]">
      <Link
        href="/contracts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Tilbake til kontrakter
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy dark:text-white mb-1">Last opp kontrakt</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Last opp en signert PDF for ansatte som fikk kontrakten sin før dette systemet ble tatt i bruk.
      </p>

      <form onSubmit={handleUpload} className="flex flex-col gap-4 max-w-md">
        <div className="flex flex-col gap-1.5">
          <Label>Navn på ansatt</Label>
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
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Bedrift (valgfritt)</Label>
          <Select value={selectedCompanyId} onValueChange={(val) => val && setSelectedCompanyId(val)}>
            <SelectTrigger className="w-full h-9">
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signed-date">Dato kontrakten ble signert (valgfritt)</Label>
          <DateInput
            id="signed-date"
            value={signedDate}
            onChange={(e) => setSignedDate(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pdf-file">PDF-fil</Label>
          <input
            id="pdf-file"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          type="submit"
          disabled={uploading || !selectedEmployeeId || !file}
          className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium w-fit"
        >
          {uploading ? 'Laster opp...' : 'Last opp kontrakt'}
        </Button>
      </form>
    </div>
  )
}
