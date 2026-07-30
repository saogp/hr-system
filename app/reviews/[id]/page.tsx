'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarPlus, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateReviewIcs, downloadIcs } from '@/lib/ics'
import { sendPushNotification } from '@/lib/push-client'
import { useToastManager } from '@/components/ui/toast'
import { DetailPageSkeleton } from '@/components/ui/loading-skeletons'

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

type Question = { id: string; text: string; type?: 'heading' | 'question' }

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
  const toastManager = useToastManager()

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
  const [taskDeleteId, setTaskDeleteId] = useState<string | null>(null)

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
      if (data.assigned_to) {
        sendPushNotification(data.assigned_to, 'Ny oppgave', newTaskDescription, `/reviews/${review.id}`)
      }
    }
  }

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    const { error } = await supabase.from('review_tasks').update({ completed }).eq('id', taskId)
    if (!error) {
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, completed } : t)))
    }
  }

  const handleRemoveTask = async () => {
    if (!taskDeleteId) return
    const { error } = await supabase.from('review_tasks').delete().eq('id', taskDeleteId)
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== taskDeleteId))
    }
    setTaskDeleteId(null)
  }

  const handleCompleteMeeting = async () => {
    if (!review) return
    setCompleting(true)

    const now = new Date()
    const nowIso = now.toISOString()
    const { error } = await supabase
      .from('reviews')
      .update({ status: 'completed', completed_at: nowIso })
      .eq('id', review.id)

    if (!error) {
      setReview(prev => prev ? { ...prev, status: 'completed', completed_at: nowIso } : prev)

      const nextReviewDate = new Date(now)
      nextReviewDate.setMonth(nextReviewDate.getMonth() + 6)
      await supabase
        .from('profiles')
        .update({ next_review_date: nextReviewDate.toISOString().slice(0, 10) })
        .eq('id', review.employee_id)

      toastManager.add({ title: 'Medarbeidersamtale fullført', description: 'Neste samtale er automatisk satt om 6 måneder.' })
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
    return <DetailPageSkeleton />
  }

  return (
    <div className="p-6 max-w-[1440px]">
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
          <h1 className="text-2xl font-bold text-brand-navy dark:text-white">Medarbeidersamtale</h1>
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
        {(() => {
          let questionNumber = 0
          return review.questions.map((q) => {
            if (q.type === 'heading') {
              return (
                <p key={q.id} className="text-base font-semibold pt-1 -mb-4">{q.text}</p>
              )
            }
            questionNumber += 1
            const questionTasks = tasks.filter(t => t.question_id === q.id)
            return (
            <div key={q.id} className="space-y-3">
              <p className="font-medium">{questionNumber}. {q.text}</p>
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
                      <Button variant="ghost" size="icon-sm" onClick={() => setTaskDeleteId(t.id)}>
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
                          <SelectTrigger className="w-full h-9">
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
                        <Button size="sm" onClick={() => handleAddTask(q.id)} className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium">Legg til</Button>
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
          })
        })()}
      </div>

      {isParticipant && review.status !== 'completed' && (
        <Button
          className="mt-8 bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
          onClick={handleCompleteMeeting}
          disabled={completing}
        >
          {completing ? 'Fullfører...' : 'Fullfør møte'}
        </Button>
      )}

      <AlertDialog open={taskDeleteId !== null} onOpenChange={(open) => !open && setTaskDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil fjerne oppgaven permanent. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleRemoveTask}
            >
              Fjern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
