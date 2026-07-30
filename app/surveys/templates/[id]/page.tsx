'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { SURVEY_CATEGORIES, type SurveyCategory } from '@/lib/survey-categories'
import { ScaleInput } from '@/components/survey-scale-input'
import { FormPageSkeleton } from '@/components/ui/loading-skeletons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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

type Question = { id: string; text: string; type: 'text' | 'scale' | 'heading'; category?: SurveyCategory }

export default function SurveyTemplateEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const isNew = id === 'new'

  const [name, setName] = useState('')
  const [questions, setQuestions] = useState<Question[]>([{ id: 'q1', text: '', type: 'text' }])
  const [anonymous, setAnonymous] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

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
        router.replace('/settings')
        return
      }

      if (!isNew) {
        const { data } = await supabase
          .from('survey_templates')
          .select('name, questions, anonymous')
          .eq('id', id)
          .single()

        if (!data) {
          router.replace('/settings')
          return
        }
        setName(data.name)
        setQuestions(data.questions?.length ? data.questions : [{ id: 'q1', text: '', type: 'text' }])
        setAnonymous(data.anonymous ?? false)
        setLoading(false)
      }
    }

    load()
  }, [id, isNew, router])

  const addQuestion = (type: 'text' | 'heading' = 'text') => {
    setQuestions(prev => [...prev, { id: `q${prev.length + 1}-${Date.now()}`, text: '', type }])
  }

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index))
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

  const handleSave = async () => {
    setSaving(true)
    const cleanQuestions = questions.filter(q => q.text.trim().length > 0)

    if (isNew) {
      const { data, error } = await supabase
        .from('survey_templates')
        .insert({ name, questions: cleanQuestions, anonymous })
        .select()
        .single()

      if (!error && data) {
        router.replace(`/surveys/templates/${data.id}`)
      }
    } else {
      const { error } = await supabase
        .from('survey_templates')
        .update({ name, questions: cleanQuestions, anonymous })
        .eq('id', id)

      if (!error) {
        setSavedAt(new Date())
      }
    }

    setSaving(false)
  }

  if (loading) {
    return <FormPageSkeleton />
  }

  return (
    <div className="p-6 max-w-[1440px]">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Tilbake til innstillinger
      </Link>

      <div className="flex flex-row items-end justify-between gap-4 mb-6">
        <div className="flex flex-col gap-1.5 flex-1 max-w-sm">
          <Label htmlFor="template-name">Navn på mal</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Navn på mal"
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {savedAt && (
            <span className="text-xs text-muted-foreground">
              Lagret {savedAt.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            disabled={questions.every((q) => !q.text.trim())}
          >
            Forhåndsvis
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name}
            className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
          >
            {saving ? 'Lagrer...' : 'Lagre'}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Checkbox
          id="template-anonymous"
          checked={anonymous}
          onCheckedChange={(val) => setAnonymous(val === true)}
        />
        <Label htmlFor="template-anonymous" className="font-normal">
          Anonym undersøkelse — svarene vises ikke koblet til navn, kun hvem som har svart
        </Label>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <Label>Spørsmål</Label>
        {questions.map((q, i) => (
          <div key={q.id} className="flex items-center gap-2 flex-wrap">
            <Input
              value={q.text}
              onChange={(e) => updateQuestion(i, e.target.value)}
              placeholder={q.type === 'heading' ? 'Skriv en overskrift...' : 'Skriv et spørsmål...'}
              className={`flex-1 min-w-40 ${q.type === 'heading' ? 'font-semibold' : ''}`}
            />
            {q.type !== 'heading' && (
              <Select value={q.type} onValueChange={(val) => val && updateQuestionType(i, val as 'text' | 'scale')}>
                <SelectTrigger className="w-32 h-9 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Fritekst</SelectItem>
                  <SelectItem value="scale">Skala 1-5</SelectItem>
                </SelectContent>
              </Select>
            )}
            {q.type === 'scale' && (
              <Select value={q.category ?? ''} onValueChange={(val) => val && updateQuestionCategory(i, val as SurveyCategory)}>
                <SelectTrigger className="w-36 h-9 shrink-0">
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
              size="icon-sm"
              className="shrink-0"
              onClick={() => removeQuestion(i)}
              disabled={questions.length === 1}
            >
              <X className="size-4" />
              <span className="sr-only">Fjern spørsmål</span>
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => addQuestion('text')}>
          <Plus className="size-4" />
          Legg til spørsmål
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Forhåndsvisning</DialogTitle>
            <DialogDescription>Slik ser undersøkelsen ut for mottakeren.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto -mx-4 px-4">
            <h2 className="text-lg font-bold">{name || 'Uten navn'}</h2>
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
