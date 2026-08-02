'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, X, ImagePlus, Printer, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { printGroupQrCode } from '@/lib/cleaning-qr'
import { normalizeCleaningQuestions, type CleaningQuestionBlock } from '@/lib/cleaning'
import { FormPageSkeleton } from '@/components/ui/loading-skeletons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function CleaningChecklistTemplatePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const isNew = id === 'new'

  const [groupName, setGroupName] = useState('')
  const [questions, setQuestions] = useState<CleaningQuestionBlock[]>([])
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

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!isAdminLike(applyRoleOverride(profile?.role ?? 'employee'))) {
        router.replace('/settings')
        return
      }

      if (!isNew) {
        const { data } = await supabase.from('cleaning_room_groups').select('name, questions').eq('id', id).single()
        if (!data) {
          router.replace('/settings')
          return
        }
        setGroupName(data.name)
        setQuestions(normalizeCleaningQuestions(data.questions ?? []))
        setLoading(false)
      }
    }
    load()
  }, [id, isNew, router])

  const addBlock = (type: CleaningQuestionBlock['type']) => {
    setQuestions((prev) => [...prev, { type, text: '' }])
  }

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, text: string) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, text } : q)))
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
    const cleanQuestions = questions.filter((q) => q.text.trim().length > 0)

    if (isNew) {
      const { data: existing } = await supabase
        .from('cleaning_room_groups')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single()

      const { data, error } = await supabase
        .from('cleaning_room_groups')
        .insert({ name: groupName, questions: cleanQuestions, sort_order: (existing?.sort_order ?? 0) + 1 })
        .select()
        .single()

      if (!error && data) {
        router.replace(`/renhold/sjekkliste/${data.id}`)
      }
    } else {
      const { error } = await supabase
        .from('cleaning_room_groups')
        .update({ name: groupName, questions: cleanQuestions })
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

  const previewQuestions = questions.filter((q) => q.type === 'question' && q.text.trim())

  return (
    <div className="p-6 max-w-[1440px]">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Tilbake til innstillinger
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
        <div className="flex flex-col gap-1.5 flex-1 max-w-sm">
          <Label htmlFor="template-name">Navn på mal</Label>
          <Input
            id="template-name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Navn på mal"
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap shrink-0">
          {savedAt && (
            <span className="text-xs text-muted-foreground">
              Lagret {savedAt.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {!isNew && (
            <Button variant="outline" size="sm" onClick={() => printGroupQrCode({ id, name: groupName })}>
              <Printer />
              Skriv ut QR-kode
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            disabled={questions.every((q) => !q.text.trim())}
          >
            Forhåndsvis
          </Button>
          <Button onClick={handleSave} disabled={saving || !groupName} className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium">
            {saving ? 'Lagrer...' : 'Lagre'}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Tittelen og sjekkpunktene som vises når noen skanner QR-koden.
      </p>

      <div className="flex flex-col gap-2 mb-4">
        <Label>Sjekkliste</Label>
        {questions.map((q, i) => (
          <div key={i} className="flex items-center gap-2">
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
              placeholder={q.type === 'heading' ? 'Skriv en overskrift...' : 'Skriv et sjekkpunkt...'}
              className={q.type === 'heading' ? 'font-semibold' : ''}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              onClick={() => removeQuestion(i)}
            >
              <X className="size-4" />
              <span className="sr-only">Fjern</span>
            </Button>
          </div>
        ))}
        {questions.length === 0 && <p className="text-sm text-muted-foreground py-2">Ingen sjekkpunkter enda.</p>}

        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => addBlock('question')}>
          <Plus className="size-4" />
          Legg til sjekkpunkt
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Forhåndsvisning</DialogTitle>
            <DialogDescription>Slik ser skjemaet ut når noen scanner QR-koden.</DialogDescription>
          </DialogHeader>

          <div className="thin-scrollbar flex-1 min-h-0 space-y-4 overflow-y-auto -mx-4 px-4">
            <div className="text-center mb-2">
              <p className="text-sm font-medium text-muted-foreground mb-1">Renhold – kvittering</p>
              <h2 className="text-xl font-bold text-brand-navy dark:text-white">{groupName || 'Uten navn'}</h2>
            </div>

            {questions.length > 0 && (
              <div className="space-y-2">
                {questions.map((q, i) =>
                  q.type === 'heading' ? (
                    q.text.trim() && <p key={i} className="text-sm font-semibold pt-1">{q.text}</p>
                  ) : (
                    <div key={i} className="flex items-center gap-3 rounded-md border border-input p-3">
                      <Checkbox disabled />
                      <span className="text-sm">{q.text}</span>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>Avvik? (valgfritt)</Label>
              <Textarea disabled placeholder="F.eks. tom såpedispenser på lager, ødelagt kran …" />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Bilde av avvik (valgfritt, inntil 3)</Label>
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-input p-3 text-sm text-muted-foreground">
                <ImagePlus className="size-4" />
                Velg filer
              </div>
              <p className="text-xs text-muted-foreground">
                Bildene vises kun for daglig leder og slettes automatisk etter 30 dager.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Ditt navn</Label>
              <Input disabled placeholder="Fornavn Etternavn" />
            </div>

            <Button disabled className="w-full bg-brand-orange text-brand-navy font-medium">
              Bekreft rengjort
            </Button>
            {previewQuestions.length > 0 && (
              <p className="text-center text-xs text-muted-foreground -mt-2">Alle sjekkpunkter må hukes av først.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Lukk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
