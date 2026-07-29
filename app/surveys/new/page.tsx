'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push-client'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { SURVEY_TEMPLATES } from '@/lib/survey-templates'
import { SURVEY_CATEGORIES, type SurveyCategory } from '@/lib/survey-categories'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScaleInput } from '@/components/survey-scale-input'
import { ArrowLeft } from 'lucide-react'

type Person = { id: string; full_name: string | null; email: string | null }
type Company = { id: string; name: string }
type Question = { id: string; text: string; type: 'text' | 'scale'; category?: SurveyCategory }

export default function NewSurveyPage() {
  return (
    <Suspense fallback={<div className="p-8">Laster...</div>}>
      <NewSurveyPageInner />
    </Suspense>
  )
}

function NewSurveyPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [people, setPeople] = useState<Person[]>([])
  const [companies, setCompanies] = useState<Company[]>([])

  const [previewOpen, setPreviewOpen] = useState(false)
  const [templateChoice, setTemplateChoice] = useState('blank')
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<Question[]>([{ id: 'q1', text: '', type: 'text' }])
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [anonymous, setAnonymous] = useState(false)
  const [companyId, setCompanyId] = useState('none')
  const [creating, setCreating] = useState(false)

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

      if (!isAdminLike(applyRoleOverride(viewerProfile?.role ?? 'employee'))) {
        router.replace('/surveys')
        return
      }

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

      setLoading(false)
    }

    load()
  }, [router])

  useEffect(() => {
    const templateParam = searchParams.get('template')
    if (templateParam && SURVEY_TEMPLATES.some((t) => t.id === templateParam)) {
      setTemplateChoice(templateParam)
      applyTemplate(templateParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const applyTemplate = (templateId: string) => {
    if (templateId === 'blank') {
      setAnonymous(false)
      return
    }
    const template = SURVEY_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    setTitle(template.title)
    setQuestions(template.questions.map((q, i) => ({ id: `q${i + 1}`, text: q.text, type: q.type, category: q.category })))
    setAnonymous(template.anonymous ?? false)
  }

  const addQuestion = () => {
    setQuestions(prev => [...prev, { id: `q${prev.length + 1}`, text: '', type: 'text' }])
  }

  const updateQuestion = (index: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => (i === index ? { ...q, text } : q)))
  }

  const updateQuestionType = (index: number, type: 'text' | 'scale') => {
    setQuestions(prev => prev.map((q, i) => (i === index ? { ...q, type } : q)))
  }

  const updateQuestionCategory = (index: number, category: SurveyCategory) => {
    setQuestions(prev => prev.map((q, i) => (i === index ? { ...q, category } : q)))
  }

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  const toggleRecipient = (id: string, checked: boolean) => {
    setSelectedRecipients(prev => (checked ? [...prev, id] : prev.filter(r => r !== id)))
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanQuestions = questions.filter(q => q.text.trim().length > 0)
    if (cleanQuestions.length === 0 || selectedRecipients.length === 0) return
    setCreating(true)

    const { data: survey, error } = await supabase
      .from('surveys')
      .insert({ title, questions: cleanQuestions, anonymous, company_id: companyId === 'none' ? null : companyId })
      .select()
      .single()

    if (!error && survey) {
      await supabase.from('survey_recipients').insert(
        selectedRecipients.map((profileId) => ({ survey_id: survey.id, profile_id: profileId }))
      )

      for (const profileId of selectedRecipients) {
        sendPushNotification(profileId, 'Ny undersøkelse', title, `/surveys/${survey.id}`)
      }

      router.push(`/surveys/${survey.id}`)
      return
    }
    setCreating(false)
  }

  if (loading) {
    return <div className="p-8">Laster...</div>
  }

  return (
    <div className="p-6 md:p-12 max-w-2xl">
      <Link
        href="/surveys"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Tilbake til undersøkelser
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy dark:text-white mb-6">Ny undersøkelse</h1>

      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Start fra mal</Label>
          <Select
            value={templateChoice}
            onValueChange={(val) => {
              if (!val) return
              setTemplateChoice(val)
              applyTemplate(val)
            }}
          >
            <SelectTrigger className="w-full h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blank">Blank undersøkelse</SelectItem>
              {SURVEY_TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="survey-title">Tittel</Label>
          <Input id="survey-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Restaurant</Label>
          <Select value={companyId} onValueChange={(val) => val && setCompanyId(val)}>
            <SelectTrigger className="w-full h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Alle restauranter</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Spørsmål</Label>
          {questions.map((q, i) => (
            <div key={q.id} className="flex items-center gap-2 flex-wrap">
              <Input
                value={q.text}
                onChange={(e) => updateQuestion(i, e.target.value)}
                placeholder="Skriv et spørsmål..."
                className="flex-1 min-w-40"
              />
              <Select value={q.type} onValueChange={(val) => val && updateQuestionType(i, val as 'text' | 'scale')}>
                <SelectTrigger className="w-32 h-8 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Fritekst</SelectItem>
                  <SelectItem value="scale">Skala 1-5</SelectItem>
                </SelectContent>
              </Select>
              {q.type === 'scale' && (
                <Select value={q.category ?? ''} onValueChange={(val) => val && updateQuestionCategory(i, val as SurveyCategory)}>
                  <SelectTrigger className="w-36 h-8 shrink-0">
                    <SelectValue placeholder="Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {SURVEY_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeQuestion(i)}
                disabled={questions.length === 1}
              >
                Fjern
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addQuestion}>
            Legg til spørsmål
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="survey-anonymous"
            checked={anonymous}
            onCheckedChange={(val) => setAnonymous(val === true)}
          />
          <Label htmlFor="survey-anonymous" className="font-normal">
            Anonym undersøkelse — svarene vises ikke koblet til navn, kun hvem som har svart
          </Label>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Mottakere</Label>
          <div className="flex flex-col gap-2 rounded-md border border-input p-3 max-h-48 overflow-y-auto">
            {people.map((p) => {
              const checkboxId = `recipient-${p.id}`
              return (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id={checkboxId}
                    checked={selectedRecipients.includes(p.id)}
                    onCheckedChange={(val) => toggleRecipient(p.id, val === true)}
                  />
                  <Label htmlFor={checkboxId} className="font-normal">
                    {p.full_name || p.email}
                  </Label>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            disabled={questions.every((q) => !q.text.trim())}
          >
            Forhåndsvis
          </Button>
          <Button
            type="submit"
            disabled={creating || !title || selectedRecipients.length === 0}
            className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
          >
            {creating ? 'Sender...' : 'Send undersøkelse'}
          </Button>
        </div>
      </form>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Forhåndsvisning</DialogTitle>
            <DialogDescription>Slik ser undersøkelsen ut for mottakeren.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto -mx-4 px-4">
            <h2 className="text-lg font-bold">{title || 'Uten tittel'}</h2>
            {questions.filter((q) => q.text.trim()).map((q, i) => (
              <div key={q.id} className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <p className="font-medium text-sm">{i + 1}. {q.text}</p>
                {q.type === 'scale' ? (
                  <ScaleInput value="" disabled />
                ) : (
                  <Textarea disabled placeholder="Skriv svaret ditt her..." />
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Lukk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
