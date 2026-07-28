'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { IconBadge } from '@/components/ui/icon-badge'
import { GreetingIllustration } from '@/components/decorative/greeting-illustration'
import { AllDoneIllustration } from '@/components/decorative/all-done-illustration'
import { ClipboardCheck, FileText, MessageSquare, ShieldAlert, ChevronRight, type LucideIcon } from 'lucide-react'
import { applyRoleOverride } from '@/lib/role-override'

function getTimeOfDayGreeting() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'God morgen'
  if (hour >= 12 && hour < 18) return 'God dag'
  return 'God kveld'
}

function getFirstName(fullName: string) {
  return fullName.split(' ')[0] ?? fullName
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

type UnsignedContract = {
  id: string
  sent_at: string
  employee_signed_at: string | null
  admin_signed_at: string | null
  profiles: { full_name: string | null; email: string | null } | null
}

type UnreadReport = {
  id: string
  created_at: string
  profiles: { full_name: string | null; email: string | null } | null
}

export default function DashboardPage() {
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [myContracts, setMyContracts] = useState<MyContract[]>([])
  const [nextReviewDate, setNextReviewDate] = useState<string | null>(null)
  const [myReviews, setMyReviews] = useState<MyReview[]>([])
  const [myTasks, setMyTasks] = useState<MyTask[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [unsignedContracts, setUnsignedContracts] = useState<UnsignedContract[]>([])
  const [unreadReports, setUnreadReports] = useState<UnreadReport[]>([])
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
        .select('full_name, next_review_date, role')
        .eq('id', user.id)
        .maybeSingle()

      setUserName(profile?.full_name || user.email || 'Ansatt')
      setNextReviewDate(profile?.next_review_date ?? null)
      const admin = applyRoleOverride(profile?.role ?? 'employee') === 'admin'
      setIsAdmin(admin)

      if (admin) {
        const { data: unsignedData } = await supabase
          .from('contracts')
          .select('id, sent_at, employee_signed_at, admin_signed_at, profiles!contracts_profile_id_fkey(full_name, email)')
          .or('employee_signed_at.is.null,admin_signed_at.is.null')
          .order('sent_at', { ascending: false })
        if (unsignedData) setUnsignedContracts(unsignedData as unknown as UnsignedContract[])

        const { data: unreadData } = await supabase
          .from('concern_reports')
          .select('id, created_at, profiles!concern_reports_recipient_id_fkey(full_name, email)')
          .eq('read', false)
          .order('created_at', { ascending: false })
        if (unreadData) setUnreadReports(unreadData as unknown as UnreadReport[])
      }

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
  type ActionItem = {
    id: string
    icon: LucideIcon
    label: string
    sublabel?: string
    href: string
    taskId?: string
  }

  const actionItems: ActionItem[] = []

  for (const t of myTasks) {
    actionItems.push({
      id: `task-${t.id}`,
      icon: ClipboardCheck,
      label: t.description,
      sublabel: `Fra samtale med ${t.reviews?.profiles?.full_name || t.reviews?.profiles?.email || '—'}`,
      href: `/reviews/${t.review_id}`,
      taskId: t.id,
    })
  }

  for (const c of myContracts.filter((c) => !c.employee_signed_at)) {
    actionItems.push({
      id: `contract-${c.id}`,
      icon: FileText,
      label: `Signer kontrakt: ${c.contract_templates?.name || 'Kontrakt'}`,
      href: `/contracts/${c.id}`,
    })
  }

  if (reviewDueSoon && nextReviewDate) {
    actionItems.push({
      id: 'review-due',
      icon: MessageSquare,
      label: daysUntilReview! < 0
        ? 'Det er på tide med medarbeidersamtalen din'
        : 'Det er snart tid for medarbeidersamtalen din',
      sublabel: new Date(nextReviewDate).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' }),
      href: '/reviews',
    })
  }

  if (isAdmin) {
    for (const c of unsignedContracts) {
      actionItems.push({
        id: `admin-contract-${c.id}`,
        icon: FileText,
        label: `Kontrakt venter: ${c.profiles?.full_name || c.profiles?.email || '—'}`,
        href: `/contracts/${c.id}`,
      })
    }
    if (unreadReports.length > 0) {
      actionItems.push({
        id: 'si-fra',
        icon: ShieldAlert,
        label: `${unreadReports.length} ny${unreadReports.length !== 1 ? 'e' : ''} si fra-melding${unreadReports.length !== 1 ? 'er' : ''}`,
        href: '/si-fra',
      })
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-none border-brand-navy/10 bg-brand-cream dark:bg-white/5 overflow-hidden relative py-0">
          <CardContent className="p-6 flex items-center justify-between gap-4 relative z-10">
            <div className="max-w-sm">
              <p className="text-sm text-brand-navy/60 dark:text-white/60 mb-1">{getDateLine()}</p>
              <h1 className="text-2xl font-bold mb-3 text-brand-navy dark:text-white">
                {getTimeOfDayGreeting()}, {getFirstName(userName)}!
              </h1>
              {reviewDueSoon && nextReviewDate ? (
                <>
                  <p className="text-sm text-brand-navy/70 dark:text-white/70 mb-3">
                    {daysUntilReview! < 0
                      ? 'Det er på tide med medarbeidersamtalen din.'
                      : 'Det er snart tid for medarbeidersamtalen din.'}{' '}
                    ({new Date(nextReviewDate).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })})
                  </p>
                  <Button className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium" render={<Link href="/reviews" />}>
                    Se medarbeidersamtale
                  </Button>
                </>
              ) : (
                <p className="text-sm text-brand-navy/70 dark:text-white/70">Ha en fin dag på jobb.</p>
              )}
            </div>
            <GreetingIllustration className="size-36 shrink-0 hidden sm:block" />
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconBadge icon={<ClipboardCheck className="size-4" />} />
              Gjøremål
            </CardTitle>
          </CardHeader>
          <CardContent>
            {actionItems.length === 0 ? (
              <div className="flex flex-col items-center text-center py-6">
                <AllDoneIllustration className="w-40 h-auto mb-4" />
                <p className="font-medium">Alle gjøremålene er fullført</p>
                <p className="text-sm text-muted-foreground mt-1">Bra jobbet!</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {actionItems.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    {item.taskId ? (
                      <Checkbox
                        className="mt-0.5"
                        checked={false}
                        onCheckedChange={(val) => val === true && handleToggleTask(item.taskId!)}
                      />
                    ) : (
                      <item.icon className="size-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <Link href={item.href} className="flex-1 min-w-0">
                      <p className="text-sm">{item.label}</p>
                      {item.sublabel && (
                        <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
                      )}
                    </Link>
                    <Link href={item.href} className="shrink-0">
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconBadge icon={<FileText className="size-4" />} />
              Mine kontrakter
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myContracts.length === 0 ? (
              <p className="text-muted-foreground text-sm">Du har ingen kontrakter enda.</p>
            ) : (
              myContracts.map((c) => (
                <Link
                  key={c.id}
                  href={`/contracts/${c.id}`}
                  className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{c.contract_templates?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      Sendt {new Date(c.sent_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.employee_signed_at ? (
                      <Badge className="bg-green-600 hover:bg-green-700">Signert</Badge>
                    ) : (
                      <Badge variant="secondary">Venter</Badge>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconBadge icon={<MessageSquare className="size-4" />} />
              Mine medarbeidersamtaler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {myReviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">Du har ingen medarbeidersamtaler enda.</p>
            ) : (
              myReviews.map((r) => (
                <Link
                  key={r.id}
                  href={`/reviews/${r.id}`}
                  className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.scheduled_date).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
