'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

type Question = { id: string; text: string }

type Survey = {
  id: string
  title: string
  questions: Question[]
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
      const admin = viewerProfile?.role === 'admin'
      setIsAdmin(admin)

      const { data: surveyData } = await supabase
        .from('surveys')
        .select('id, title, questions')
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

  if (loading || !survey) {
    return <div className="p-8">Laster undersøkelse...</div>
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-2xl">
      <Link
        href="/surveys"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Tilbake
      </Link>

      <h1 className="text-2xl font-bold mb-8">{survey.title}</h1>

      {isAdmin ? (
        <div className="space-y-6">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen mottakere enda.</p>
          ) : (
            results.map((r) => (
              <div key={r.id} className="rounded-md border border-input p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{r.profiles?.full_name || r.profiles?.email || '—'}</p>
                  {r.submitted_at ? (
                    <Badge className="bg-green-600 hover:bg-green-700">Besvart {formatDate(r.submitted_at)}</Badge>
                  ) : (
                    <Badge variant="secondary">Venter</Badge>
                  )}
                </div>
                {r.submitted_at && (
                  <div className="space-y-2">
                    {survey.questions.map((q) => (
                      <div key={q.id}>
                        <p className="text-xs text-muted-foreground">{q.text}</p>
                        <p className="text-sm">{r.responses?.[q.id] || '—'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {survey.questions.map((q, i) => (
            <div key={q.id} className="space-y-2">
              <p className="font-medium">{i + 1}. {q.text}</p>
              <Textarea
                value={myAnswers[q.id] ?? ''}
                onChange={(e) => setMyAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Skriv svaret ditt her..."
                disabled={!!mySubmittedAt}
              />
            </div>
          ))}

          {mySubmittedAt ? (
            <Badge className="bg-green-600 hover:bg-green-700">Besvart {formatDate(mySubmittedAt)}</Badge>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Sender...' : 'Send svar'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
