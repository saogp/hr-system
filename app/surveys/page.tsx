'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { computeResponseScore } from '@/lib/survey-score'
import type { SurveyCategory } from '@/lib/survey-categories'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OrganicBlob } from '@/components/decorative/organic-blobs'
import { IconBadge } from '@/components/ui/icon-badge'
import { ChevronRight, ClipboardList } from 'lucide-react'

type Person = { id: string; full_name: string | null; email: string | null }

type Company = { id: string; name: string }

type SurveyRow = {
  id: string
  title: string
  created_at: string
  company_id: string | null
}

type MySurveyRow = {
  id: string
  survey_id: string
  submitted_at: string | null
  responses: Record<string, string> | null
  surveys: { title: string; questions: { id: string; type?: 'text' | 'scale'; category?: SurveyCategory }[] } | null
}

export default function SurveysPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [surveys, setSurveys] = useState<SurveyRow[]>([])
  const [surveyCounts, setSurveyCounts] = useState<Record<string, { total: number; submitted: number }>>({})
  const [mySurveys, setMySurveys] = useState<MySurveyRow[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('')

  const load = async () => {
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
    const admin = isAdminLike(applyRoleOverride(viewerProfile?.role ?? 'employee'))
    setIsAdmin(admin)

    if (admin) {
      const { data: peopleData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name')
      if (peopleData) setPeople(peopleData)

      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name')
        .order('name')
      if (companiesData) setCompanies(companiesData)

      const { data: surveysData } = await supabase
        .from('surveys')
        .select('id, title, created_at, company_id')
        .order('created_at', { ascending: false })
      if (surveysData) setSurveys(surveysData)

      const { data: recipientsData } = await supabase
        .from('survey_recipients')
        .select('survey_id, submitted_at')

      if (recipientsData) {
        const counts: Record<string, { total: number; submitted: number }> = {}
        for (const r of recipientsData) {
          const c = counts[r.survey_id] ?? { total: 0, submitted: 0 }
          c.total += 1
          if (r.submitted_at) c.submitted += 1
          counts[r.survey_id] = c
        }
        setSurveyCounts(counts)
      }
    } else {
      const { data: mySurveysData } = await supabase
        .from('survey_recipients')
        .select('id, survey_id, submitted_at, responses, surveys!survey_recipients_survey_id_fkey(title, questions)')
        .eq('profile_id', user.id)
        .order('id')
      if (mySurveysData) setMySurveys(mySurveysData as unknown as MySurveyRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) {
    return <div className="p-8">Laster undersøkelser...</div>
  }

  const filteredSurveys = surveys.filter((s) => {
    if (search && !s.title.toLowerCase().includes(search.toLowerCase())) return false
    if (companyFilter !== 'all' && s.company_id !== companyFilter) return false
    if (monthFilter && !s.created_at.startsWith(monthFilter)) return false
    return true
  })

  return (
    <div className="relative max-w-4xl py-10 px-4 overflow-hidden">
      <OrganicBlob className="pointer-events-none absolute -right-20 -top-24 -z-10 h-72 w-72 opacity-90" />
      <OrganicBlob className="pointer-events-none absolute -left-24 top-72 -z-10 h-56 w-56 opacity-60 rotate-45" />
      <OrganicBlob className="pointer-events-none absolute right-10 bottom-0 -z-10 h-48 w-48 opacity-40 -rotate-12" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy dark:text-white mb-1 flex items-center gap-2">
          <IconBadge icon={<ClipboardList className="size-4" />} />
          Undersøkelser
        </h1>
        <p className="text-muted-foreground text-sm">
          {isAdmin ? 'Send undersøkelser til ansatte om hvordan de jobber.' : 'Dine undersøkelser.'}
        </p>
      </div>

      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Søk etter undersøkelse..."
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
          <Button
            render={<Link href="/surveys/new" />}
            disabled={people.length === 0}
            className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium shrink-0"
          >
            Ny undersøkelse
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {isAdmin ? (
          filteredSurveys.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Ingen undersøkelser funnet.</p>
          ) : (
            filteredSurveys.map((s) => {
              const counts = surveyCounts[s.id] ?? { total: 0, submitted: 0 }
              return (
                <Link
                  key={s.id}
                  href={`/surveys/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white dark:bg-white/5 p-4 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-base md:text-sm truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">Opprettet {formatDate(s.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-muted-foreground">{counts.submitted} av {counts.total}</span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              )
            })
          )
        ) : mySurveys.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">Ingen undersøkelser enda.</p>
        ) : (
          mySurveys.map((s) => {
            const score = s.submitted_at ? computeResponseScore(s.surveys?.questions ?? [], s.responses) : null
            return (
              <Link
                key={s.id}
                href={`/surveys/${s.survey_id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white dark:bg-white/5 p-4 hover:bg-muted/50"
              >
                <p className="font-medium text-base md:text-sm truncate">{s.surveys?.title || '—'}</p>
                <div className="flex items-center gap-3 shrink-0">
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
      </div>
    </div>
  )
}
