'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function getTimeOfDayGreeting() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'God morgen'
  if (hour >= 12 && hour < 18) return 'God dag'
  return 'God kveld'
}

function getDateLine() {
  const formatted = new Date().toLocaleDateString('no-NO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

type MyContract = {
  id: string
  sent_at: string
  employee_signed_at: string | null
  contract_templates: { name: string } | null
}

type MyReview = {
  id: string
  scheduled_date: string
  status: 'open' | 'completed'
}

type MyTask = {
  id: string
  description: string
  completed: boolean
  review_id: string
  reviews: {
    employee_id: string
    profiles: { full_name: string | null; email: string | null } | null
  } | null
}

export default function DashboardPage() {
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [myContracts, setMyContracts] = useState<MyContract[]>([])
  const [nextReviewDate, setNextReviewDate] = useState<string | null>(null)
  const [myReviews, setMyReviews] = useState<MyReview[]>([])
  const [myTasks, setMyTasks] = useState<MyTask[]>([])
  const router = useRouter()

  useEffect(() => {
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, next_review_date')
        .eq('id', user.id)
        .maybeSingle()

      setUserName(profile?.full_name || user.email || 'Ansatt')
      setNextReviewDate(profile?.next_review_date ?? null)

      const { data: contractsData } = await supabase
        .from('contracts')
        .select('id, sent_at, employee_signed_at, contract_templates!contracts_template_id_fkey(name)')
        .eq('profile_id', user.id)
        .order('sent_at', { ascending: false })

      if (contractsData) setMyContracts(contractsData as unknown as MyContract[])

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('id, scheduled_date, status')
        .or(`employee_id.eq.${user.id},leader_id.eq.${user.id}`)
        .order('scheduled_date', { ascending: false })

      if (reviewsData) setMyReviews(reviewsData)

      const { data: tasksData } = await supabase
        .from('review_tasks')
        .select('id, description, completed, review_id, reviews!review_tasks_review_id_fkey(employee_id, profiles!reviews_employee_id_fkey(full_name, email))')
        .eq('assigned_to', user.id)
        .eq('completed', false)
        .order('created_at')

      if (tasksData) setMyTasks(tasksData as unknown as MyTask[])

      setLoading(false)
    }

    getUserData()
  }, [router])

  const handleToggleTask = async (taskId: string) => {
    const { error } = await supabase.from('review_tasks').update({ completed: true }).eq('id', taskId)
    if (!error) {
      setMyTasks(prev => prev.filter(t => t.id !== taskId))
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Laster inn dashbord...</div>
  }

  const daysUntilReview = nextReviewDate
    ? Math.ceil((new Date(nextReviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const reviewDueSoon = daysUntilReview !== null && daysUntilReview <= 14

  return (
    <div className="p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Avatar className="size-5">
            <AvatarFallback className="text-[10px]">{getInitials(userName)}</AvatarFallback>
          </Avatar>
          {getDateLine()}
        </div>
        <h1 className="text-2xl font-bold">{getTimeOfDayGreeting()}, {userName}</h1>
      </div>

      {reviewDueSoon && nextReviewDate && (
        <Card className="shadow-none border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
          <CardContent className="pt-6">
            <p className="text-sm">
              {daysUntilReview! < 0
                ? 'Det er på tide med medarbeidersamtalen din.'
                : 'Det er snart tid for medarbeidersamtalen din.'}{' '}
              <span className="text-muted-foreground">
                ({new Date(nextReviewDate).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })})
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      {myTasks.length > 0 && (
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Mine oppgaver</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myTasks.map((t) => (
              <div key={t.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                <Checkbox
                  className="mt-0.5"
                  checked={false}
                  onCheckedChange={(val) => val === true && handleToggleTask(t.id)}
                />
                <div className="flex-1">
                  <p className="text-sm">{t.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Fra medarbeidersamtale med {t.reviews?.profiles?.full_name || t.reviews?.profiles?.email || '—'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" render={<Link href={`/reviews/${t.review_id}`} />}>
                  Åpne
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Mine kontrakter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {myContracts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Du har ingen kontrakter enda.</p>
          ) : (
            myContracts.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">{c.contract_templates?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    Sendt {new Date(c.sent_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {c.employee_signed_at ? (
                    <Badge className="bg-green-600 hover:bg-green-700">Signert</Badge>
                  ) : (
                    <Badge variant="secondary">Venter</Badge>
                  )}
                  <Button variant="ghost" size="sm" render={<Link href={`/contracts/${c.id}`} />}>
                    Åpne
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Mine medarbeidersamtaler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {myReviews.length === 0 ? (
            <p className="text-muted-foreground text-sm">Du har ingen medarbeidersamtaler enda.</p>
          ) : (
            myReviews.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                <p className="text-xs text-muted-foreground">
                  {new Date(r.scheduled_date).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <div className="flex items-center gap-3">
                  {r.status === 'completed' ? (
                    <Badge className="bg-green-600 hover:bg-green-700">Fullført</Badge>
                  ) : (
                    <Badge variant="secondary">Åpen</Badge>
                  )}
                  <Button variant="ghost" size="sm" render={<Link href={`/reviews/${r.id}`} />}>
                    Åpne
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}