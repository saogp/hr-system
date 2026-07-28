'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push-client'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronRight, MessageSquare } from 'lucide-react'
import { IconBadge } from '@/components/ui/icon-badge'
import { applyRoleOverride } from '@/lib/role-override'

type PersonOption = {
  id: string
  full_name: string | null
  email: string | null
}

type ReviewTemplate = {
  id: string
  name: string
  questions: { id: string; text: string }[]
}

type Company = { id: string; name: string }

type ReviewRow = {
  id: string
  scheduled_date: string
  status: 'open' | 'completed'
  employee_id: string
  leader_id: string | null
  profiles: { full_name: string | null; email: string | null } | null
}

export default function ReviewsPage() {
  const router = useRouter()
  const [role, setRole] = useState<'admin' | 'manager' | 'employee' | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [people, setPeople] = useState<PersonOption[]>([])
  const [templates, setTemplates] = useState<ReviewTemplate[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [employeeCompanies, setEmployeeCompanies] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('')

  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [selectedLeaderId, setSelectedLeaderId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10))

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }
    setCurrentUserId(user.id)

    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const currentRole = applyRoleOverride(viewerProfile?.role ?? 'employee') as 'admin' | 'manager' | 'employee'
    setRole(currentRole)

    if (currentRole === 'admin') {
      const { data: peopleData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name')
      if (peopleData) setPeople(peopleData)

      const { data: templatesData } = await supabase
        .from('review_templates')
        .select('id, name, questions')
        .order('name')
      if (templatesData) setTemplates(templatesData)

      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .order('name')
      if (companiesData) setCompanies(companiesData)

      const { data: pcData } = await supabase
        .from('profile_companies')
        .select('profile_id, company_id')
      if (pcData) {
        const map: Record<string, string[]> = {}
        for (const row of pcData) {
          map[row.profile_id] = [...(map[row.profile_id] ?? []), row.company_id]
        }
        setEmployeeCompanies(map)
      }

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('id, scheduled_date, status, employee_id, leader_id, profiles!reviews_employee_id_fkey(full_name, email)')
        .order('scheduled_date', { ascending: false })
      if (reviewsData) setReviews(reviewsData as unknown as ReviewRow[])
    } else {
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('id, scheduled_date, status, employee_id, leader_id, profiles!reviews_employee_id_fkey(full_name, email)')
        .or(`employee_id.eq.${user.id},leader_id.eq.${user.id}`)
        .order('scheduled_date', { ascending: false })
      if (reviewsData) setReviews(reviewsData as unknown as ReviewRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    const template = templates.find(t => t.id === selectedTemplateId)

    const { error } = await supabase.from('reviews').insert({
      employee_id: selectedEmployeeId,
      leader_id: selectedLeaderId || null,
      template_id: selectedTemplateId || null,
      scheduled_date: scheduledDate,
      questions: template?.questions ?? [],
    })

    if (!error) {
      setScheduleOpen(false)
      const dateLabel = new Date(scheduledDate).toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })
      sendPushNotification(selectedEmployeeId, 'Medarbeidersamtale planlagt', `Du har fått en medarbeidersamtale ${dateLabel}.`, '/reviews')
      setSelectedEmployeeId('')
      setSelectedLeaderId('')
      setSelectedTemplateId('')
      setScheduledDate(new Date().toISOString().slice(0, 10))
      load()
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) {
    return <div className="p-8">Laster medarbeidersamtaler...</div>
  }

  const filteredReviews = reviews.filter((r) => {
    if (search) {
      const name = (r.profiles?.full_name || r.profiles?.email || '').toLowerCase()
      if (!name.includes(search.toLowerCase())) return false
    }
    if (companyFilter !== 'all' && !(employeeCompanies[r.employee_id] ?? []).includes(companyFilter)) return false
    if (monthFilter && !r.scheduled_date.startsWith(monthFilter)) return false
    return true
  })

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
            <IconBadge icon={<MessageSquare className="size-4" />} />
            Medarbeidersamtaler
          </h1>
          <p className="text-muted-foreground text-sm">
            {role === 'admin' ? 'Alle medarbeidersamtaler.' : 'Dine medarbeidersamtaler.'}
          </p>
        </div>
        {role === 'admin' && (
          <Button
            onClick={() => setScheduleOpen(true)}
            disabled={people.length === 0}
            className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
          >
            Ny samtale
          </Button>
        )}
      </div>

      {role === 'admin' && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <Input
            placeholder="Søk etter ansatt..."
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
      )}

      <div className="flex flex-col gap-2">
        {filteredReviews.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            Ingen medarbeidersamtaler funnet.
          </p>
        ) : (
          filteredReviews.map((r) => (
            <Link
              key={r.id}
              href={`/reviews/${r.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  {r.profiles?.full_name || r.profiles?.email || '—'}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(r.scheduled_date)}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {r.status === 'completed' ? (
                  <Badge className="bg-green-600 hover:bg-green-700">Fullført</Badge>
                ) : (
                  <Badge variant="secondary">Åpen</Badge>
                )}
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          ))
        )}
      </div>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny medarbeidersamtale</DialogTitle>
            <DialogDescription>Velg ansatt, leder og en samtalemal.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSchedule} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Ansatt</Label>
              <Select value={selectedEmployeeId} onValueChange={(val) => val && setSelectedEmployeeId(val)}>
                <SelectTrigger className="w-full h-8">
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
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Leder (vert)</Label>
              <Select value={selectedLeaderId} onValueChange={(val) => val && setSelectedLeaderId(val)}>
                <SelectTrigger className="w-full h-8">
                  <SelectValue placeholder="Velg leder" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Mal</Label>
              <Select value={selectedTemplateId} onValueChange={(val) => val && setSelectedTemplateId(val)}>
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduled-date">Dato</Label>
              <Input
                id="scheduled-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={!selectedEmployeeId || !selectedTemplateId}
                className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
              >
                Planlegg samtale
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
