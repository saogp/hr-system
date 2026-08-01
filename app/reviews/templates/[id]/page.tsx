'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { FormPageSkeleton } from '@/components/ui/loading-skeletons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Question = { id: string; text: string; type?: 'heading' | 'question' }

export default function ReviewTemplateEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const isNew = id === 'new'

  const [name, setName] = useState('')
  const [questions, setQuestions] = useState<Question[]>([{ id: 'q1', text: '' }])
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
          .from('review_templates')
          .select('name, questions')
          .eq('id', id)
          .single()

        if (!data) {
          router.replace('/settings')
          return
        }
        setName(data.name)
        setQuestions(data.questions?.length ? data.questions : [{ id: 'q1', text: '' }])
        setLoading(false)
      }
    }

    load()
  }, [id, isNew, router])

  const addQuestion = (type: 'heading' | 'question' = 'question') => {
    setQuestions(prev => [...prev, { id: `q${prev.length + 1}-${Date.now()}`, text: '', type }])
  }

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => (i === index ? { ...q, text } : q)))
  }

  const moveQuestion = (index: number, direction: -1 | 1) => {
    setQuestions((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const cleanQuestions = questions.filter(q => q.text.trim().length > 0)

    if (isNew) {
      const { data, error } = await supabase
        .from('review_templates')
        .insert({ name, questions: cleanQuestions })
        .select()
        .single()

      if (!error && data) {
        router.replace(`/reviews/templates/${data.id}`)
      }
    } else {
      const { error } = await supabase
        .from('review_templates')
        .update({ name, questions: cleanQuestions })
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

      <div className="flex flex-col gap-3 mb-4">
        <Label>Spørsmål</Label>
        {questions.map((q, i) => (
          <div key={q.id} className="flex items-center gap-2">
            <div className="flex flex-col shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-4"
                onClick={() => moveQuestion(i, -1)}
                disabled={i === 0}
              >
                <ChevronUp className="size-3" />
                <span className="sr-only">Flytt opp</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-4"
                onClick={() => moveQuestion(i, 1)}
                disabled={i === questions.length - 1}
              >
                <ChevronDown className="size-3" />
                <span className="sr-only">Flytt ned</span>
              </Button>
            </div>
            <Input
              value={q.text}
              onChange={(e) => updateQuestion(i, e.target.value)}
              placeholder={q.type === 'heading' ? 'Skriv en overskrift...' : 'Skriv et spørsmål...'}
              className={q.type === 'heading' ? 'font-semibold' : ''}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              onClick={() => removeQuestion(i)}
              disabled={questions.length === 1}
            >
              <X className="size-4" />
              <span className="sr-only">Fjern</span>
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => addQuestion('question')}>
          <Plus className="size-4" />
          Legg til spørsmål
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Forhåndsvisning</DialogTitle>
            <DialogDescription>Slik ser medarbeidersamtalen ut.</DialogDescription>
          </DialogHeader>

          <div className="thin-scrollbar flex-1 min-h-0 space-y-4 overflow-y-auto -mx-4 px-4">
            <h2 className="text-lg font-bold">{name || 'Uten navn'}</h2>
            {(() => {
              let questionNumber = 0
              return questions.filter((q) => q.text.trim()).map((q) => {
                if (q.type === 'heading') {
                  return <p key={q.id} className="text-sm font-semibold pt-1">{q.text}</p>
                }
                questionNumber += 1
                return (
                  <div key={q.id} className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                    <p className="font-medium text-sm">{questionNumber}. {q.text}</p>
                    <Textarea disabled placeholder="Skriv svaret ditt her..." />
                  </div>
                )
              })
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Lukk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
