'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, SprayCan, Plus, X, ImagePlus, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { printGroupQrCode } from '@/lib/cleaning-qr'
import { IconBadge } from '@/components/ui/icon-badge'
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

  const [loading, setLoading] = useState(true)
  const [groupName, setGroupName] = useState('')
  const [questions, setQuestions] = useState<string[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
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
        router.replace('/')
        return
      }

      const { data } = await supabase.from('cleaning_room_groups').select('name, questions').eq('id', id).single()
      if (!data) {
        router.replace('/settings')
        return
      }
      setGroupName(data.name)
      setQuestions(data.questions)
      setLoading(false)
    }
    load()
  }, [id, router])

  const addQuestion = () => {
    if (!newQuestion.trim()) return
    setQuestions((prev) => [...prev, newQuestion.trim()])
    setNewQuestion('')
  }

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  const updateQuestion = (index: number, text: string) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? text : q)))
  }

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('cleaning_room_groups').update({ questions }).eq('id', id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return <div className="p-8">Laster...</div>
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

      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
          <IconBadge icon={<SprayCan className="size-4" />} />
          {groupName} – sjekkliste
        </h1>
        <Button variant="outline" size="sm" className="shrink-0" onClick={() => printGroupQrCode({ id, name: groupName })}>
          <Printer />
          Skriv ut QR-kode
        </Button>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Sjekkpunktene som vises når noen skanner QR-koden for {groupName.toLowerCase()}.
      </p>

      <div className="flex flex-col gap-2 mb-4">
        <Label>Sjekkpunkter</Label>
        {questions.map((q, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-5 shrink-0">{i + 1}.</span>
            <Input
              value={q}
              onChange={(e) => updateQuestion(i, e.target.value)}
              placeholder="Skriv et sjekkpunkt..."
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              onClick={() => removeQuestion(i)}
            >
              <X className="size-4" />
              <span className="sr-only">Fjern sjekkpunkt</span>
            </Button>
          </div>
        ))}
        {questions.length === 0 && <p className="text-sm text-muted-foreground py-2">Ingen sjekkpunkter enda.</p>}

        <div className="flex items-center gap-2">
          <span className="w-5 shrink-0" />
          <Input
            placeholder="Nytt sjekkpunkt..."
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addQuestion())}
          />
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={addQuestion}>
            <Plus className="size-4" />
            Legg til
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setPreviewOpen(true)}>
          Forhåndsvis
        </Button>
        <Button onClick={handleSave} disabled={saving} className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium">
          {saving ? 'Lagrer...' : 'Lagre'}
        </Button>
        {saved && <p className="text-sm text-green-600">Lagret!</p>}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Forhåndsvisning</DialogTitle>
            <DialogDescription>Slik ser skjemaet ut når noen scanner QR-koden.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto -mx-4 px-4">
            <div className="text-center mb-2">
              <p className="text-sm font-medium text-muted-foreground mb-1">Renhold – kvittering</p>
              <h2 className="text-xl font-bold text-brand-navy dark:text-white">{groupName}, rom</h2>
              <p className="text-muted-foreground text-sm">
                {new Date().toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </p>
            </div>

            {questions.length > 0 && (
              <div>
                <Label className="mb-2 block">Sjekkpunkter – huk av etter hvert som det er gjort</Label>
                <div className="flex flex-col divide-y divide-border rounded-md border border-input">
                  {questions.map((q) => (
                    <div key={q} className="flex items-center gap-3 p-3">
                      <Checkbox disabled />
                      <span className="text-sm">{q}</span>
                    </div>
                  ))}
                </div>
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
            {questions.length > 0 && (
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
