'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { IconBadge } from '@/components/ui/icon-badge'
import { GreetingIllustration } from '@/components/decorative/greeting-illustration'
import { AllDoneIllustration } from '@/components/decorative/all-done-illustration'
import { ClipboardCheck, ClipboardList, FileText, MessageSquare, ShieldAlert, ChevronRight, Sparkles, UserCheck, Package, Info, Users, SprayCan, type LucideIcon } from 'lucide-react'
import { needsCardCredentials } from '@/lib/uniform-items'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { computeCategoryScores, computeResponseScore, type ScoredQuestion } from '@/lib/survey-score'
import type { SurveyCategory } from '@/lib/survey-categories'
import { computeProfileCompletion } from '@/lib/profile-completion'
import { computeArbeidCompletion } from '@/lib/arbeid-completion'
import { DashboardSkeleton } from '@/components/ui/loading-skeletons'

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

function getAnniversaryLabel(startDate: string | null): string | null {
  if (!startDate) return null

  const start = new Date(startDate)
  const today = new Date()

  if (today.getDate() !== start.getDate()) return null

  const monthsSinceStart =
    (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth())

  if (monthsSinceStart < 12 || monthsSinceStart % 6 !== 0) return null

  const years = Math.floor(monthsSinceStart / 12)
  const remainderMonths = monthsSinceStart % 12
  return remainderMonths === 0 ? `${years} år` : `${years} år og ${remainderMonths} måneder`
}

type FunFact = { text: string; answer?: string }

const FUN_FACTS: FunFact[] = [
  { text: 'Visste du at den første pizzaen med tomat, mozzarella og basilikum ble laget i Napoli i 1889, og fargene skal ha representert det italienske flagget?' },
  { text: 'Visste du at ordet «pizza» dukket opp skriftlig for første gang i Italia allerede i år 997?' },
  { text: 'Visste du at verdens største pizza noensinne ble laget i Roma i 2012 og veide over 19 tonn?' },
  { text: 'Visste du at italienere spiser pizza med kniv og gaffel, mens resten av verden ofte tar den med hendene?' },
  { text: 'Visste du at 9. februar er internasjonal pizzadag?' },
  { text: 'Gåte: Hva blir mer verdt jo mer du bruker av det?', answer: 'Erfaring' },
  { text: 'Gåte: Hva har mange nøkler, men kan ikke åpne en eneste dør?', answer: 'Et piano' },
  { text: 'Visste du at det å ta korte pauser i løpet av arbeidsdagen kan gjøre deg mer produktiv, ikke mindre?' },
  { text: 'Visste du at et smil, selv et påtatt et, kan bidra til å redusere stress?' },
  { text: 'Gåte: Jo mer du tar bort fra meg, jo større blir jeg. Hva er jeg?', answer: 'Et hull' },
  { text: 'Visste du at gjennomsnittlig nordmann drikker over 8 kg kaffe i året — en av de høyeste tallene i verden?' },
  { text: 'Visste du at det tar rundt 20 minutter for hjernen å registrere at magen er mett?' },
]

function getFunFactOfTheDay(): FunFact {
  const start = new Date(new Date().getFullYear(), 0, 0)
  const diff = Date.now() - start.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  return FUN_FACTS[dayOfYear % FUN_FACTS.length]
}

type MyContract = {
  id: string
  sent_at: string
  employee_signed_at: string | null
  template_id: string | null
  contract_templates: { name: string } | null
}

type MyReview = {
  id: string
  scheduled_date: string
  status: 'open' | 'completed'
}

type MySurvey = {
  id: string
  survey_id: string
  submitted_at: string | null
  responses: Record<string, string> | null
  surveys: { title: string; questions: ScoredQuestion[] } | null
}

type MyUniformIssuance = {
  id: string
  items: { type: string; size: string; quantity: number; card_number: string | null }[]
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

type MissingContractPerson = {
  id: string
  full_name: string | null
  email: string | null
}

type MissingArbeidPerson = {
  id: string
  full_name: string | null
  email: string | null
}

export default function DashboardPage() {
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [myContracts, setMyContracts] = useState<MyContract[]>([])
  const [nextReviewDate, setNextReviewDate] = useState<string | null>(null)
  const [myReviews, setMyReviews] = useState<MyReview[]>([])
  const [mySurveys, setMySurveys] = useState<MySurvey[]>([])
  const [myUniformIssuances, setMyUniformIssuances] = useState<MyUniformIssuance[]>([])
  const [myTasks, setMyTasks] = useState<MyTask[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [unsignedContracts, setUnsignedContracts] = useState<UnsignedContract[]>([])
  const [missingContractPeople, setMissingContractPeople] = useState<MissingContractPerson[]>([])
  const [missingArbeidPeople, setMissingArbeidPeople] = useState<MissingArbeidPerson[]>([])
  const [unreadReports, setUnreadReports] = useState<UnreadReport[]>([])
  const [engagementOverall, setEngagementOverall] = useState<number | null>(null)
  const [engagementCategories, setEngagementCategories] = useState<{ category: SurveyCategory; label: string; score: number | null }[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [profileCompletionPercent, setProfileCompletionPercent] = useState(100)
  const [profileMissingLabels, setProfileMissingLabels] = useState<string[]>([])
  const [birthdaysToday, setBirthdaysToday] = useState<string[]>([])
  const [myBirthdayToday, setMyBirthdayToday] = useState(false)
  const [anniversaryLabel, setAnniversaryLabel] = useState<string | null>(null)
  const [companyActiveCounts, setCompanyActiveCounts] = useState<{ name: string; count: number }[]>([])
  const [cleaningStatus, setCleaningStatus] = useState<{ name: string; done: number; total: number }[]>([])
  const [riddleRevealed, setRiddleRevealed] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, next_review_date, role, birth_date, start_date, phone, address, emergency_contact_name, emergency_contact_phone')
        .eq('id', user.id)
        .maybeSingle()

      const completion = computeProfileCompletion(profile ?? {})
      setProfileCompletionPercent(completion.percent)
      setProfileMissingLabels(completion.missing.map((f) => f.label))

      setUserName(profile?.full_name || user.email || 'Ansatt')
      setNextReviewDate(profile?.next_review_date ?? null)
      const admin = isAdminLike(applyRoleOverride(profile?.role ?? 'employee'))
      setIsAdmin(admin)

      const todayMonthDay = new Date().toISOString().slice(5, 10)
      if (profile?.birth_date && profile.birth_date.slice(5, 10) === todayMonthDay) {
        setMyBirthdayToday(true)
      }
      setAnniversaryLabel(getAnniversaryLabel(profile?.start_date ?? null))

      const companyActiveCountsPromise = admin
        ? (async () => {
            const { data: myCompanyLinks } = await supabase
              .from('profile_companies')
              .select('company_id, companies(name)')
              .eq('profile_id', user.id)
            if (!myCompanyLinks || myCompanyLinks.length === 0) return null

            const companyIds = myCompanyLinks.map((c) => c.company_id)
            const { data: allLinks } = await supabase
              .from('profile_companies')
              .select('company_id, profiles(is_active)')
              .in('company_id', companyIds)

            const counts = new Map<string, number>()
            for (const link of (allLinks ?? []) as unknown as { company_id: string; profiles: { is_active: boolean } | null }[]) {
              if (link.profiles?.is_active) {
                counts.set(link.company_id, (counts.get(link.company_id) ?? 0) + 1)
              }
            }
            return (myCompanyLinks as unknown as { company_id: string; companies: { name: string } | null }[]).map((c) => ({
              name: c.companies?.name ?? '—',
              count: counts.get(c.company_id) ?? 0,
            }))
          })()
        : Promise.resolve(null)

      const nullData = Promise.resolve({ data: null })

      const [
        birthdaysResult,
        companyActiveCounts,
        { data: cleaningGroupsData },
        { data: cleaningRoomsData },
        { data: cleaningChecksData },
        { data: unsignedData },
        { data: activeProfilesData },
        { data: allContractsData },
        { data: arbeidProfilesData },
        { data: allCompanyLinksData },
        { data: unreadData },
        { data: allSurveysData },
        { data: submittedData },
        { data: contractsData },
        { data: reviewsData },
        { data: myFullSurveysData },
        { data: myUniformData },
        { data: tasksData },
      ] = await Promise.all([
        admin
          ? supabase.from('profiles').select('full_name, birth_date').neq('id', user.id)
          : supabase.rpc('get_people_directory'),
        companyActiveCountsPromise,
        admin
          ? supabase.from('cleaning_room_groups').select('id, name, sort_order').order('sort_order')
          : nullData,
        admin ? supabase.from('cleaning_rooms').select('id, group_id') : nullData,
        admin
          ? supabase.from('cleaning_checks').select('room_id').eq('check_date', new Date().toISOString().slice(0, 10))
          : nullData,
        admin
          ? supabase
              .from('contracts')
              .select('id, sent_at, employee_signed_at, admin_signed_at, profiles!contracts_profile_id_fkey(full_name, email)')
              .not('template_id', 'is', null)
              .or('employee_signed_at.is.null,admin_signed_at.is.null')
              .order('sent_at', { ascending: false })
          : nullData,
        admin ? supabase.from('profiles').select('id, full_name, email').eq('is_active', true) : nullData,
        admin ? supabase.from('contracts').select('profile_id') : nullData,
        admin
          ? supabase
              .from('profiles')
              .select('id, full_name, email, title, employment_type, position_percentage, start_date')
              .eq('is_active', true)
          : nullData,
        admin ? supabase.from('profile_companies').select('profile_id') : nullData,
        admin
          ? supabase
              .from('concern_reports')
              .select('id, created_at, profiles!concern_reports_recipient_id_fkey(full_name, email)')
              .eq('read', false)
              .order('created_at', { ascending: false })
          : nullData,
        admin ? supabase.from('surveys').select('id, questions') : nullData,
        admin
          ? supabase.from('survey_recipients').select('survey_id, responses').not('submitted_at', 'is', null)
          : nullData,
        supabase
          .from('contracts')
          .select('id, sent_at, employee_signed_at, template_id, contract_templates!contracts_template_id_fkey(name)')
          .eq('profile_id', user.id)
          .order('sent_at', { ascending: false }),
        supabase
          .from('reviews')
          .select('id, scheduled_date, status')
          .or(`employee_id.eq.${user.id},leader_id.eq.${user.id}`)
          .order('scheduled_date', { ascending: false }),
        supabase
          .from('survey_recipients')
          .select('id, survey_id, submitted_at, responses, surveys!survey_recipients_survey_id_fkey(title, questions)')
          .eq('profile_id', user.id)
          .order('id'),
        supabase.from('uniform_issuances').select('id, items').eq('profile_id', user.id).is('employee_signed_at', null),
        supabase
          .from('review_tasks')
          .select('id, description, completed, review_id, reviews!review_tasks_review_id_fkey(employee_id, profiles!reviews_employee_id_fkey(full_name, email))')
          .eq('assigned_to', user.id)
          .eq('completed', false)
          .order('created_at'),
      ])

      if (admin) {
        const allBirthdays = birthdaysResult.data as { full_name: string | null; birth_date: string | null }[] | null
        if (allBirthdays) {
          const names = allBirthdays
            .filter((p) => p.birth_date && p.birth_date.slice(5, 10) === todayMonthDay)
            .map((p) => p.full_name || 'Ukjent')
          setBirthdaysToday(names)
        }
      } else {
        const directoryData = birthdaysResult.data as { id: string; full_name: string | null; is_birthday_today: boolean }[] | null
        if (directoryData) {
          const names = directoryData
            .filter((p) => p.is_birthday_today && p.id !== user.id)
            .map((p) => p.full_name || 'Ukjent')
          setBirthdaysToday(names)
        }
      }

      if (companyActiveCounts) setCompanyActiveCounts(companyActiveCounts)

      if (admin) {
        if (cleaningGroupsData && cleaningRoomsData) {
          const doneRoomIds = new Set((cleaningChecksData ?? []).map((c: { room_id: string }) => c.room_id))
          setCleaningStatus(
            cleaningGroupsData.map((g) => {
              const groupRooms = cleaningRoomsData.filter((r) => r.group_id === g.id)
              const done = groupRooms.filter((r) => doneRoomIds.has(r.id)).length
              return { name: g.name, done, total: groupRooms.length }
            })
          )
        }

        if (unsignedData) setUnsignedContracts(unsignedData as unknown as UnsignedContract[])

        if (activeProfilesData) {
          const withContract = new Set((allContractsData ?? []).map((c: { profile_id: string }) => c.profile_id))
          setMissingContractPeople(activeProfilesData.filter((p) => !withContract.has(p.id)))
        }

        if (arbeidProfilesData) {
          const withCompany = new Set((allCompanyLinksData ?? []).map((c: { profile_id: string }) => c.profile_id))
          setMissingArbeidPeople(
            arbeidProfilesData.filter((p) => !computeArbeidCompletion(p, withCompany.has(p.id)).complete)
          )
        }

        if (unreadData) setUnreadReports(unreadData as unknown as UnreadReport[])

        if (allSurveysData && submittedData) {
          const surveyById = new Map(allSurveysData.map((s) => [s.id, s.questions]))
          const entries = submittedData
            .map((r) => ({ questions: surveyById.get(r.survey_id) ?? [], responses: r.responses }))
            .filter((e) => e.questions.length > 0)
          const { overall, categories } = computeCategoryScores(entries)
          setEngagementOverall(overall)
          setEngagementCategories(categories)
        }
      }

      if (contractsData) setMyContracts(contractsData as unknown as MyContract[])
      if (reviewsData) setMyReviews(reviewsData)
      if (myFullSurveysData) setMySurveys(myFullSurveysData as unknown as MySurvey[])
      if (myUniformData) setMyUniformIssuances(myUniformData as unknown as MyUniformIssuance[])
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
    return <DashboardSkeleton />
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

  if (profileCompletionPercent < 100 && currentUserId) {
    actionItems.push({
      id: 'profile-completion',
      icon: UserCheck,
      label: 'Fyll ut profilen din',
      sublabel: `Mangler: ${profileMissingLabels.join(', ')}`,
      href: `/people/${currentUserId}?edit=1`,
    })
  }

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

  for (const c of myContracts.filter((c) => c.template_id && !c.employee_signed_at)) {
    actionItems.push({
      id: `contract-${c.id}`,
      icon: FileText,
      label: `Signer kontrakt: ${c.contract_templates?.name || 'Kontrakt'}`,
      href: `/contracts/${c.id}`,
    })
  }

  for (const u of myUniformIssuances) {
    actionItems.push({
      id: `uniform-${u.id}`,
      icon: Package,
      label: 'Bekreft mottak av utstyr',
      sublabel: u.items
        .map((i) => needsCardCredentials(i.type)
          ? `${i.type}${i.card_number ? ` (nr. ${i.card_number})` : ''}`
          : `${i.type}${i.size !== 'Ingen' ? ` (${i.size})` : ''}`)
        .join(', '),
      href: `/uniformer/${u.id}`,
    })
  }

  for (const s of mySurveys.filter((s) => !s.submitted_at)) {
    actionItems.push({
      id: `survey-${s.id}`,
      icon: ClipboardList,
      label: `Svar på undersøkelse: ${s.surveys?.title || 'Undersøkelse'}`,
      href: `/surveys/${s.survey_id}`,
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
    if (missingContractPeople.length > 0) {
      actionItems.push({
        id: 'missing-contracts',
        icon: FileText,
        label: `${missingContractPeople.length} ${missingContractPeople.length !== 1 ? 'ansatte' : 'ansatt'} mangler kontrakt`,
        sublabel: missingContractPeople.map((p) => p.full_name || p.email || '—').join(', '),
        href: '/people',
      })
    }
    if (missingArbeidPeople.length > 0) {
      actionItems.push({
        id: 'missing-arbeid',
        icon: UserCheck,
        label: `${missingArbeidPeople.length} ${missingArbeidPeople.length !== 1 ? 'ansatte' : 'ansatt'} mangler arbeidsinfo`,
        sublabel: missingArbeidPeople.map((p) => p.full_name || p.email || '—').join(', '),
        href: '/people',
      })
    }
  }

  return (
    <div className="max-w-[1440px] p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 shadow-none border-brand-navy/10 bg-brand-cream dark:bg-white/5 overflow-hidden relative py-0">
          <CardContent className="flex-1 p-6 flex items-center justify-between gap-4 relative z-10">
            <div className="max-w-sm">
              <p className="text-sm text-brand-navy/60 dark:text-white/60 mb-1">{getDateLine()}</p>
              <h1 className="text-2xl font-bold mb-3 text-brand-navy dark:text-white">
                {getTimeOfDayGreeting()}, {getFirstName(userName)}!
              </h1>
              <p className="text-sm text-brand-navy/70 dark:text-white/70">Ha en fin dag på jobb.</p>
            </div>
            <GreetingIllustration className="size-36 shrink-0 hidden sm:block" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconBadge icon={<ClipboardCheck className="size-4" />} />
              Gjøremål
            </CardTitle>
            {actionItems.length > 0 && (
              <CardAction>
                <Badge className="bg-brand-orange/15 text-brand-navy dark:text-brand-orange hover:bg-brand-orange/15">
                  {actionItems.length}
                </Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="flex-1">
            {actionItems.length === 0 ? (
              <div className="flex flex-col items-center text-center py-6">
                <AllDoneIllustration className="w-40 h-auto mb-4" />
                <p className="font-medium">Alle gjøremålene er fullført</p>
                <p className="text-sm text-muted-foreground mt-1">Bra jobbet!</p>
              </div>
            ) : (
              <div className="thin-scrollbar space-y-3 max-h-64 overflow-y-auto pr-1">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className={`shadow-none border-border ${isAdmin ? '' : 'lg:col-span-3'}`}>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconBadge icon={<Info className="size-4" />} />
              Visste du at
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {myBirthdayToday && birthdaysToday.length > 0 ? (
              <p className="text-sm">🎉 Gratulerer med dagen! I dag er det også bursdag til {birthdaysToday.join(', ')}.</p>
            ) : myBirthdayToday ? (
              <p className="text-sm">🎉 Gratulerer med dagen!</p>
            ) : birthdaysToday.length > 0 ? (
              <p className="text-sm">🎉 I dag er det bursdag til {birthdaysToday.join(', ')}!</p>
            ) : anniversaryLabel ? (
              <p className="text-sm">Du har jobbet her i {anniversaryLabel} — gratulerer med jubileum!</p>
            ) : (
              (() => {
                const fact = getFunFactOfTheDay()
                return (
                  <div className="text-sm">
                    <p>{fact.text}</p>
                    {fact.answer && (
                      riddleRevealed ? (
                        <p className="mt-1 text-muted-foreground">Svar: {fact.answer}</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRiddleRevealed(true)}
                          className="mt-1 text-brand-orange font-medium hover:underline"
                        >
                          Vis svar
                        </button>
                      )
                    )}
                  </div>
                )
              })()
            )}
          </CardContent>
        </Card>

        {isAdmin && (
        <Card className="lg:col-span-2 shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconBadge icon={<Sparkles className="size-4" />} />
              Trivselspuls
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {engagementOverall === null ? (
              <p className="text-sm text-muted-foreground">
                Ingen skala-baserte undersøkelser er besvart enda. Send en undersøkelse med skala-spørsmål (f.eks. Trivselsundersøkelse) for å se en samlet score her.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="flex flex-row sm:flex-col items-baseline sm:items-start gap-2 sm:gap-1 shrink-0 sm:w-28">
                  <p className="text-4xl font-bold text-brand-navy dark:text-white">{engagementOverall}</p>
                  <p className="text-xs text-muted-foreground">av alle besvarte undersøkelser</p>
                </div>
                <div className="flex-1 space-y-3">
                  {engagementCategories.map((c) => (
                    <div key={c.category} className="flex items-center gap-3">
                      <span className="w-28 text-sm shrink-0 truncate">{c.label}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        {c.score !== null && (
                          <div className="h-full bg-brand-orange rounded-full" style={{ width: `${c.score}%` }} />
                        )}
                      </div>
                      <span className={`w-8 text-sm text-right shrink-0 ${c.score === null ? 'text-muted-foreground' : ''}`}>
                        {c.score !== null ? c.score : '–'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      {isAdmin && (companyActiveCounts.length > 0 || cleaningStatus.length > 0) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {companyActiveCounts.length > 0 && (
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconBadge icon={<Users className="size-4" />} />
              Totale ansatte
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {companyActiveCounts.map((c) => (
              <div key={c.name} className="flex items-center justify-between gap-2 h-11 border-b border-border last:border-0">
                <p className="text-sm text-brand-navy dark:text-white truncate">{c.name}</p>
                <p className="text-lg font-bold text-brand-orange shrink-0">{c.count}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        )}

        {cleaningStatus.length > 0 && (
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconBadge icon={<SprayCan className="size-4" />} />
              Renhold
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <Link href="/renhold" className="flex flex-col">
              {cleaningStatus.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between gap-2 h-11 border-b border-border last:border-0"
                >
                  <p className="text-sm text-brand-navy dark:text-white truncate">{s.name}</p>
                  <span className={`text-sm font-medium shrink-0 ${s.done === s.total ? 'text-green-600' : 'text-destructive'}`}>
                    {s.done}/{s.total} rengjort
                  </span>
                </div>
              ))}
            </Link>
          </CardContent>
        </Card>
        )}
      </div>
      )}

      {!isAdmin && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconBadge icon={<FileText className="size-4" />} />
              Mine kontrakter
            </CardTitle>
          </CardHeader>
          <CardContent className="thin-scrollbar max-h-64 overflow-y-auto space-y-3">
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
                    <p className="font-medium text-base md:text-sm truncate">{c.contract_templates?.name || '—'}</p>
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
          <CardContent className="thin-scrollbar max-h-64 overflow-y-auto space-y-3">
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

        <Card className="shadow-none border-border">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <IconBadge icon={<ClipboardCheck className="size-4" />} />
              Mine undersøkelser
            </CardTitle>
          </CardHeader>
          <CardContent className="thin-scrollbar max-h-64 overflow-y-auto space-y-3">
            {mySurveys.length === 0 ? (
              <p className="text-muted-foreground text-sm">Du har ingen undersøkelser enda.</p>
            ) : (
              mySurveys.map((s) => {
                const score = s.submitted_at ? computeResponseScore(s.surveys?.questions ?? [], s.responses) : null
                return (
                  <Link
                    key={s.id}
                    href={`/surveys/${s.survey_id}`}
                    className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <p className="font-medium text-base md:text-sm truncate">{s.surveys?.title || '—'}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.submitted_at ? (
                        <Badge className="bg-green-600 hover:bg-green-700">{score !== null ? `${score} poeng` : 'Besvart'}</Badge>
                      ) : (
                        <Badge variant="secondary">Venter</Badge>
                      )}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </Link>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  )
}
