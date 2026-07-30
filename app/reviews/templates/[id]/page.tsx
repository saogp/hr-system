'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'

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

type Question = { id: string; text: string }

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

  const addQuestion = () => {
    setQuestions(prev => [...prev, { id: `q${prev.length + 1}-${Date.now()}`, text: '' }])
  }

  const removeQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => (i === index ? { ...q, text } : q)))
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
    return <div className="p-8">Laster mal...</div>
  }

  return (
    <div className="p-6 max-w-2xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Tilbake til innstillinger
      </Link>

      <div className="flex flex-row items-center justify-between gap-4 mb-6">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Navn på mal"
          className="text-lg font-semibold h-10 border-none px-0 shadow-none focus-visible:ring-0"
        />
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
            <span className="text-sm text-muted-foreground w-5 shrink-0">{i + 1}.</span>
            <Input
              value={q.text}
              onChange={(e) => updateQuestion(i, e.target.value)}
              placeholder="Skriv et spørsmål..."
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
              <span className="sr-only">Fjern spørsmål</span>
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addQuestion}>
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

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto -mx-4 px-4">
            <h2 className="text-lg font-bold">{name || 'Uten navn'}</h2>
            {questions.filter((q) => q.text.trim()).map((q, i) => (
              <div key={q.id} className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <p className="font-medium text-sm">{i + 1}. {q.text}</p>
                <Textarea disabled placeholder="Skriv svaret ditt her..." />
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
