'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarPlus, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateReviewIcs, downloadIcs } from '@/lib/ics'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Question = { id: string; text: string }

type Review = {
  id: string
  employee_id: string
  leader_id: string | null
  scheduled_date: string
  questions: Question[]
  answers: Record<string, string>
  status: 'open' | 'completed'
  completed_at: string | null
}

type PersonInfo = { id: string; full_name: string | null; email: string | null }

type Task = {
  id: string
  review_id: string
  question_id: string | null
  description: string
  assigned_to: string | null
  completed: boolean
}

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [review, setReview] = useState<Review | null>(null)
  const [employeeInfo, setEmployeeInfo] = useState<PersonInfo | null>(null)
  const [leaderInfo, setLeaderInfo] = useState<PersonInfo | null>(null)
  const [people, setPeople] = useState<PersonInfo[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null)
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      setCurrentUserId(user.id)

      const { data: reviewData } = await supabase
        .from('reviews')
        .select('*')
        .eq('id', id)
        .single()

      if (!reviewData) {
        router.replace('/reviews')
        return
      }
      setReview(reviewData)
      setAnswers(reviewData.answers ?? {})

      const { data: employeeData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', reviewData.employee_id)
        .single()
      if (employeeData) setEmployeeInfo(employeeData)

      if (reviewData.leader_id) {
        const { data: leaderData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', reviewData.leader_id)
          .single()
        if (leaderData) setLeaderInfo(leaderData)
      }

      const { data: peopleData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name')
      if (peopleData) setPeople(peopleData)

      const { data: tasksData } = await supabase
        .from('review_tasks')
        .select('*')
        .eq('review_id', id)
        .order('created_at')
      if (tasksData) setTasks(tasksData)

      setLoading(false)
    }

    load()
  }, [id, router])

  const isParticipant = currentUserId === review?.employee_id || currentUserId === review?.leader_id

  const handleSaveAnswer = async (questionId: string, text: string) => {
    if (!review) return
    const newAnswers = { ...answers, [questionId]: text }
    setAnswers(newAnswers)

    await supabase.from('reviews').update({ answers: newAnswers }).eq('id', review.id)
  }

  const handleAddTask = async (questionId: string) => {
    if (!review || !newTaskDescription.trim()) return

    const { data, error } = await supabase
      .from('review_tasks')
      .insert({
        review_id: review.id,
        question_id: questionId,
        description: newTaskDescription,
        assigned_to: newTaskAssignee || null,
      })
      .select()
      .single()

    if (!error && data) {
      setTasks(prev => [...prev, data])
      setAddingTaskFor(null)
      setNewTaskDescription('')
      setNewTaskAssignee('')
    }
  }

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    const { error } = await supabase.from('review_tasks').update({ completed }).eq('id', taskId)
    if (!error) {
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, completed } : t)))
    }
  }

  const handleRemoveTask = async (taskId: string) => {
    const { error } = await supabase.from('review_tasks').delete().eq('id', taskId)
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== taskId))
    }
  }

  const handleCompleteMeeting = async () => {
    if (!review) return
    setCompleting(true)

    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('reviews')
      .update({ status: 'completed', completed_at: nowIso })
      .eq('id', review.id)

    if (!error) {
      setReview(prev => prev ? { ...prev, status: 'completed', completed_at: nowIso } : prev)
    }
    setCompleting(false)
  }

  const getPersonName = (personId: string | null) => {
    if (!personId) return null
    return people.find(p => p.id === personId)?.full_name || people.find(p => p.id === personId)?.email
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  const handleAddToCalendar = () => {
    if (!review) return
    const ics = generateReviewIcs({
      id: review.id,
      scheduledDate: review.scheduled_date,
      employeeName: employeeInfo?.full_name || employeeInfo?.email || 'Ansatt',
      leaderName: leaderInfo?.full_name || leaderInfo?.email || null,
    })
    downloadIcs('medarbeidersamtale.ics', ics)
  }

  if (loading || !review) {
    return <div className="p-8">Laster medarbeidersamtale...</div>
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/reviews"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Tilbake
        </Link>
        {review.status === 'completed' ? (
          <Badge className="bg-green-600 hover:bg-green-700">Fullført</Badge>
        ) : (
          <Badge variant="secondary">Åpen</Badge>
        )}
      </div>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Medarbeidersamtale</h1>
          <p className="text-muted-foreground text-sm">{formatDate(review.scheduled_date)}</p>
          <p className="text-sm mt-2">
            {employeeInfo?.full_name || employeeInfo?.email || '—'}
            {leaderInfo && <> og {leaderInfo.full_name || leaderInfo.email} (vert)</>}
          </p>
        </div>
        {isParticipant && (
          <Button variant="outline" size="sm" onClick={handleAddToCalendar} className="shrink-0">
            <CalendarPlus className="size-4" />
            Legg til i kalender
          </Button>
        )}
      </div>

      <div className="space-y-8">
        {review.questions.map((q, i) => {
          const questionTasks = tasks.filter(t => t.question_id === q.id)
          return (
            <div key={q.id} className="space-y-3">
              <p className="font-medium">{i + 1}. {q.text}</p>
              <Textarea
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                onBlur={(e) => handleSaveAnswer(q.id, e.target.value)}
                placeholder="Skriv svaret ditt her..."
                disabled={!isParticipant || review.status === 'completed'}
              />

              <div className="space-y-2 pl-1">
                <p className="text-xs text-muted-foreground">Oppfølgingsoppgaver</p>
                {questionTasks.map((t) => (
                  <div key={t.id} className="flex items-start gap-2">
                    <Checkbox
                      checked={t.completed}
                      onCheckedChange={(val) => handleToggleTask(t.id, val === true)}
                      className="mt-0.5"
                    />
                    <div className="flex-1">
                      <p className={`text-sm ${t.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {t.description}
                      </p>
                      {t.assigned_to && (
                        <p className="text-xs text-muted-foreground">
                          Tildelt: {getPersonName(t.assigned_to)}
                        </p>
                      )}
                    </div>
                    {isParticipant && (
                      <Button variant="ghost" size="icon-sm" onClick={() => handleRemoveTask(t.id)}>
                        <X className="size-3.5" />
                        <span className="sr-only">Fjern oppgave</span>
                      </Button>
                    )}
                  </div>
                ))}

                {isParticipant && review.status !== 'completed' && (
                  addingTaskFor === q.id ? (
                    <div className="flex flex-col gap-2 rounded-md border border-input p-3">
                      <Input
                        placeholder="Beskriv oppgaven..."
                        value={newTaskDescription}
                        onChange={(e) => setNewTaskDescription(e.target.value)}
                      />
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">Tildelt til</Label>
                        <Select value={newTaskAssignee} onValueChange={(val) => val && setNewTaskAssignee(val)}>
                          <SelectTrigger className="w-full h-8">
                            <SelectValue placeholder="Velg person" />
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
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAddTask(q.id)}>Legg til</Button>
                        <Button size="sm" variant="outline" onClick={() => setAddingTaskFor(null)}>Avbryt</Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => setAddingTaskFor(q.id)}
                    >
                      <Plus className="size-4" />
                      Legg til oppgave
                    </Button>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>

      {isParticipant && review.status !== 'completed' && (
        <Button className="mt-8" onClick={handleCompleteMeeting} disabled={completing}>
          {completing ? 'Fullfører...' : 'Fullfør møte'}
        </Button>
      )}
    </div>
  )
}
