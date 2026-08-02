'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push-client'
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
import { Combobox, COMBOBOX_SEARCH_THRESHOLD } from '@/components/ui/combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'

type PersonOption = {
  id: string
  full_name: string | null
  email: string | null
  role: string
}

type ReviewTemplate = {
  id: string
  name: string
  questions: { id: string; text: string }[]
}

export default function NewReviewPage() {
  return (
    <Suspense fallback={<FormPageSkeleton />}>
      <NewReviewPageInner />
    </Suspense>
  )
}

function NewReviewPageInner() {
  const router = useRouter()
  const toastManager = useToastManager()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [people, setPeople] = useState<PersonOption[]>([])
  const [templates, setTemplates] = useState<ReviewTemplate[]>([])

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [selectedLeaderId, setSelectedLeaderId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [scheduling, setScheduling] = useState(false)

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
        router.replace('/reviews')
        return
      }

      const { data: peopleData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name')
      if (peopleData) setPeople(peopleData)

      const { data: templatesData } = await supabase
        .from('review_templates')
        .select('id, name, questions')
        .order('name')
      if (templatesData) {
        setTemplates(templatesData)
        const templateParam = searchParams.get('template')
        if (templatesData.some((t) => t.id === templateParam)) {
          setSelectedTemplateId(templateParam!)
        }
      }

      setLoading(false)
    }

    load()
  }, [router])

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    setScheduling(true)
    const template = templates.find(t => t.id === selectedTemplateId)

    const { data: review, error } = await supabase.from('reviews').insert({
      employee_id: selectedEmployeeId,
      leader_id: selectedLeaderId || null,
      template_id: selectedTemplateId || null,
      scheduled_date: scheduledDate,
      questions: template?.questions ?? [],
    }).select().single()

    if (!error && review) {
      const dateLabel = new Date(scheduledDate).toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })
      sendPushNotification(selectedEmployeeId, 'Medarbeidersamtale planlagt', `Du har fått en medarbeidersamtale ${dateLabel}.`, '/reviews')

      const { data: { session } } = await supabase.auth.getSession()
      fetch('/api/reviews/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ reviewId: review.id, employeeId: selectedEmployeeId, leaderId: selectedLeaderId || null, dateLabel }),
      }).catch(() => {})

      toastManager.add({ title: 'Medarbeidersamtale planlagt', description: `Planlagt ${dateLabel}.` })
      router.push('/reviews')
      return
    }
    setScheduling(false)
  }

  if (loading) {
    return <FormPageSkeleton />
  }

  const leaderOptions = people.filter((p) => p.role === 'admin' || p.role === 'manager')

  const cameFromTemplate = !!searchParams.get('template')

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href={cameFromTemplate ? '/settings' : '/reviews'}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        {cameFromTemplate ? 'Tilbake til innstillinger' : 'Tilbake til medarbeidersamtaler'}
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy dark:text-white mb-1">Ny medarbeidersamtale</h1>
      <p className="text-muted-foreground text-sm mb-6">Velg ansatt, leder og en samtalemal.</p>

      <form onSubmit={handleSchedule} className="flex flex-col gap-4">
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
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Leder (vert)</Label>
          {leaderOptions.length > COMBOBOX_SEARCH_THRESHOLD ? (
            <Combobox
              value={selectedLeaderId}
              onValueChange={setSelectedLeaderId}
              placeholder="Velg leder"
              options={leaderOptions.map((p) => ({ value: p.id, label: p.full_name || p.email || '' }))}
            />
          ) : (
            <Select value={selectedLeaderId} onValueChange={(val) => val && setSelectedLeaderId(val)}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="Velg leder" />
              </SelectTrigger>
              <SelectContent>
                {leaderOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Mal</Label>
          <Select value={selectedTemplateId} onValueChange={(val) => val && setSelectedTemplateId(val)}>
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scheduled-date">Dato</Label>
          <DateInput
            id="scheduled-date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            required
          />
        </div>

        <Button
          type="submit"
          disabled={scheduling || !selectedEmployeeId || !selectedTemplateId}
          className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium w-fit"
        >
          {scheduling ? 'Planlegger...' : 'Planlegg samtale'}
        </Button>
      </form>
    </div>
  )
}
