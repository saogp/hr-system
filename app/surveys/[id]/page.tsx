'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { OrganicBlob } from '@/components/decorative/organic-blobs'
import { ScaleInput } from '@/components/survey-scale-input'
import { applyRoleOverride } from '@/lib/role-override'
import { computeResponseScore } from '@/lib/survey-score'
import type { SurveyCategory } from '@/lib/survey-categories'

type Question = { id: string; text: string; type?: 'text' | 'scale'; category?: SurveyCategory }

type Survey = {
  id: string
  title: string
  questions: Question[]
  anonymous: boolean
}

type RecipientResult = {
  id: string
  profile_id: string
  responses: Record<string, string>
  submitted_at: string | null
  profiles: { full_name: string | null; email: string | null } | null
}

export default function SurveyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [survey, setSurvey] = useState<Survey | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [results, setResults] = useState<RecipientResult[]>([])
  const [myRecipientId, setMyRecipientId] = useState<string | null>(null)
  const [myAnswers, setMyAnswers] = useState<Record<string, string>>({})
  const [mySubmittedAt, setMySubmittedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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
      const admin = applyRoleOverride(viewerProfile?.role ?? 'employee') === 'admin'
      setIsAdmin(admin)

      const { data: surveyData } = await supabase
        .from('surveys')
        .select('id, title, questions, anonymous')
        .eq('id', id)
        .single()

      if (!surveyData) {
        router.replace('/surveys')
        return
      }
      setSurvey(surveyData)

      if (admin) {
        const { data: resultsData } = await supabase
          .from('survey_recipients')
          .select('id, profile_id, responses, submitted_at, profiles!survey_recipients_profile_id_fkey(full_name, email)')
          .eq('survey_id', id)
        if (resultsData) setResults(resultsData as unknown as RecipientResult[])
      } else {
        const { data: mine } = await supabase
          .from('survey_recipients')
          .select('id, responses, submitted_at')
          .eq('survey_id', id)
          .eq('profile_id', user.id)
          .single()

        if (!mine) {
          router.replace('/surveys')
          return
        }
        setMyRecipientId(mine.id)
        setMyAnswers(mine.responses ?? {})
        setMySubmittedAt(mine.submitted_at)
      }

      setLoading(false)
    }

    load()
  }, [id, router])

  const handleSubmit = async () => {
    if (!myRecipientId) return
    setSubmitting(true)

    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('survey_recipients')
      .update({ responses: myAnswers, submitted_at: nowIso })
      .eq('id', myRecipientId)

    if (!error) {
      setMySubmittedAt(nowIso)
    }
    setSubmitting(false)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  const shuffled = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5)

  if (loading || !survey) {
    return <div className="p-8">Laster undersøkelse...</div>
  }

  return (
    <div className="container relative mx-auto py-10 px-4 max-w-2xl overflow-hidden">
      <OrganicBlob className="pointer-events-none absolute -right-16 -top-16 -z-10 h-56 w-56 opacity-90" />
      <OrganicBlob className="pointer-events-none absolute -left-20 bottom-10 -z-10 h-48 w-48 opacity-50 rotate-45" />

      <Link
        href="/surveys"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Tilbake
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy dark:text-white mb-8">{survey.title}</h1>

      {isAdmin ? (
        <div className="space-y-8">
          {survey.anonymous && (
            <div className="rounded-md border border-border bg-white dark:bg-white/5 p-4">
              <p className="text-sm">
                Denne undersøkelsen er anonym. Svarene under er ikke koblet til navn — statusoversikten
                brukes kun til å minne om undersøkelsen.
              </p>
            </div>
          )}

          <div>
            <h2 className="text-base font-semibold mb-3">Status</h2>
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ingen mottakere enda.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border rounded-md border border-border bg-white dark:bg-white/5">
                {results.map((r) => {
                  const score = r.submitted_at ? computeResponseScore(survey.questions, r.responses) : null
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-2 p-3">
                      <p className="text-sm">{r.profiles?.full_name || r.profiles?.email || '—'}</p>
                      {r.submitted_at ? (
                        <Badge className="bg-green-600 hover:bg-green-700">
                          {score !== null ? `${score} poeng` : `Besvart ${formatDate(r.submitted_at)}`}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Venter</Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-base font-semibold mb-3">Svar</h2>
            {results.every((r) => !r.submitted_at) ? (
              <p className="text-sm text-muted-foreground">Ingen har svart enda.</p>
            ) : survey.anonymous ? (
              <div className="space-y-4">
                {survey.questions.map((q) => {
                  const answers = shuffled(
                    results.filter((r) => r.submitted_at && r.responses?.[q.id]).map((r) => r.responses[q.id])
                  )
                  return (
                    <div key={q.id} className="rounded-md border border-border bg-white dark:bg-white/5 p-4">
                      <p className="text-sm font-medium mb-2">{q.text}</p>
                      {answers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Ingen svar enda.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {answers.map((a, i) => (
                            <li key={i} className="text-sm border-b border-border pb-1.5 last:border-0 last:pb-0">
                              {q.type === 'scale' ? `${a} / 5` : a}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="space-y-4">
                {results.filter((r) => r.submitted_at).map((r) => (
                  <div key={r.id} className="rounded-md border border-border bg-white dark:bg-white/5 p-4 space-y-2">
                    <p className="font-medium text-sm">{r.profiles?.full_name || r.profiles?.email || '—'}</p>
                    {survey.questions.map((q) => (
                      <div key={q.id}>
                        <p className="text-xs text-muted-foreground">{q.text}</p>
                        <p className="text-sm">
                          {r.responses?.[q.id] ? (q.type === 'scale' ? `${r.responses[q.id]} / 5` : r.responses[q.id]) : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {survey.anonymous && (
            <div className="rounded-md border border-border bg-white dark:bg-white/5 p-4">
              <p className="text-sm">
                Svarene er anonyme. Vi ser ikke hvem som har svart hva — bare de samlede svarene.
              </p>
            </div>
          )}
          {survey.questions.map((q, i) => (
            <div key={q.id} className="space-y-2">
              <p className="font-medium">{i + 1}. {q.text}</p>
              {q.type === 'scale' ? (
                <ScaleInput
                  value={myAnswers[q.id] ?? ''}
                  onChange={(val) => setMyAnswers(prev => ({ ...prev, [q.id]: val }))}
                  disabled={!!mySubmittedAt}
                />
              ) : (
                <Textarea
                  value={myAnswers[q.id] ?? ''}
                  onChange={(e) => setMyAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Skriv svaret ditt her..."
                  disabled={!!mySubmittedAt}
                  className="bg-white dark:bg-white/5"
                />
              )}
            </div>
          ))}

          {mySubmittedAt ? (
            <Badge className="bg-green-600 hover:bg-green-700">
              {(() => {
                const score = computeResponseScore(survey.questions, myAnswers)
                return score !== null ? `${score} poeng` : `Besvart ${formatDate(mySubmittedAt)}`
              })()}
            </Badge>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting} className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium">
              {submitting ? 'Sender...' : 'Send svar'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
