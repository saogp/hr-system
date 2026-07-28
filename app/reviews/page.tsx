'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  const [loading, setLoading] = useState(true)

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
    const currentRole = viewerProfile?.role ?? 'employee'
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

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Medarbeidersamtaler</h1>
          <p className="text-muted-foreground text-sm">
            {role === 'admin' ? 'Alle medarbeidersamtaler.' : 'Dine medarbeidersamtaler.'}
          </p>
        </div>
        {role === 'admin' && (
          <Button onClick={() => setScheduleOpen(true)} disabled={people.length === 0}>
            Ny samtale
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ansatt</TableHead>
            <TableHead>Dato</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Handling</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                Ingen medarbeidersamtaler registrert enda.
              </TableCell>
            </TableRow>
          ) : (
            reviews.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {r.profiles?.full_name || r.profiles?.email || '—'}
                </TableCell>
                <TableCell>{formatDate(r.scheduled_date)}</TableCell>
                <TableCell>
                  {r.status === 'completed' ? (
                    <Badge className="bg-green-600 hover:bg-green-700">Fullført</Badge>
                  ) : (
                    <Badge variant="secondary">Åpen</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" render={<Link href={`/reviews/${r.id}`} />}>
                    Åpne
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

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
              <Button type="submit" disabled={!selectedEmployeeId || !selectedTemplateId}>
                Planlegg samtale
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
