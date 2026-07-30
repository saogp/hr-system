'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { SprayCan, CheckCircle2, ImagePlus, X } from 'lucide-react'
import { normalizeCleaningQuestions, type CleaningQuestionBlock } from '@/lib/cleaning'
import { CenteredCardSkeleton } from '@/components/ui/loading-skeletons'
import { IconBadge } from '@/components/ui/icon-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

type Room = { id: string; name: string }
type GroupInfo = {
  group: { id: string; name: string; questions: CleaningQuestionBlock[] }
  rooms: Room[]
}

export default function GroupCheckinPage() {
  const { id } = useParams<{ id: string }>()

  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<GroupInfo | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({})
  const [deviationNote, setDeviationNote] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/cleaning/group/${id}`)
      const result = await res.json()
      if (res.ok) {
        setInfo({ ...result, group: { ...result.group, questions: normalizeCleaningQuestions(result.group.questions ?? []) } })
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room)
    setCheckedMap({})
    setDeviationNote('')
    setPhotos([])
    setName('')
    setDone(false)
    setError('')
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 3)
    setPhotos(files)
  }

  const handleSubmit = async () => {
    if (!selectedRoom || !info) return
    setSubmitting(true)
    setError('')

    const checklist = info.group.questions
      .filter((q) => q.type === 'question')
      .map((q) => ({ question: q.text, checked: !!checkedMap[q.text] }))

    const formData = new FormData()
    formData.append('roomId', selectedRoom.id)
    formData.append('checkedByName', name)
    formData.append('deviationNote', deviationNote)
    formData.append('checklist', JSON.stringify(checklist))
    photos.forEach((p) => formData.append('photos', p))

    const res = await fetch('/api/cleaning/check', { method: 'POST', body: formData })

    if (!res.ok) {
      setError('Noe gikk galt. Prøv igjen.')
      setSubmitting(false)
      return
    }

    setDone(true)
    setSubmitting(false)
  }

  const formatDate = () =>
    new Date().toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (loading) {
    return <CenteredCardSkeleton />
  }

  if (!info) {
    return <div className="p-8 text-center">Fant ikke gruppen.</div>
  }

  if (done) {
    return (
      <div className="py-10 px-6 max-w-sm mx-auto text-center">
        <div className="flex flex-col items-center gap-2 py-10">
          <CheckCircle2 className="size-12 text-green-600" />
          <p className="font-medium text-lg">Registrert!</p>
          <p className="text-sm text-muted-foreground">{selectedRoom?.name}</p>
        </div>
        <Button variant="outline" onClick={() => setSelectedRoom(null)} className="w-full">
          Registrer et annet rom
        </Button>
      </div>
    )
  }

  const checklistQuestions = info.group.questions.filter((q) => q.type === 'question')
  const allChecked = checklistQuestions.length === 0 || checklistQuestions.every((q) => checkedMap[q.text])

  if (!selectedRoom) {
    return (
      <div className="py-10 px-6 max-w-sm mx-auto text-center">
        <div className="flex justify-center mb-3">
          <IconBadge icon={<SprayCan className="size-4" />} className="size-10" />
        </div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-white mb-1">{info.group.name}</h1>
        <p className="text-muted-foreground text-sm mb-6">Velg hvilket rom du har rengjort</p>

        <div className="flex flex-col gap-2">
          {info.rooms.map((room) => (
            <Button
              key={room.id}
              variant="outline"
              className="h-12 text-base justify-center"
              onClick={() => handleSelectRoom(room)}
            >
              {room.name}
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="py-10 px-6 max-w-sm mx-auto">
      <div className="text-center mb-6">
        <p className="text-sm font-medium text-muted-foreground mb-1">Renhold – kvittering</p>
        <h1 className="text-xl font-bold text-brand-navy dark:text-white">{selectedRoom.name}</h1>
        <p className="text-muted-foreground text-sm">{formatDate()}</p>
      </div>

      {info.group.questions.length > 0 && (
        <div className="mb-6">
          {checklistQuestions.length > 0 && (
            <Label className="mb-2 block">Sjekkpunkter – huk av etter hvert som det er gjort</Label>
          )}
          <div className="flex flex-col gap-3">
            {info.group.questions.map((q, i) =>
              q.type === 'heading' ? (
                q.text.trim() && <p key={i} className="text-sm font-semibold pt-1">{q.text}</p>
              ) : (
                <label key={i} className="flex items-center gap-3 p-3 rounded-md border border-input cursor-pointer">
                  <Checkbox
                    checked={!!checkedMap[q.text]}
                    onCheckedChange={(val) => setCheckedMap((prev) => ({ ...prev, [q.text]: val === true }))}
                  />
                  <span className="text-sm">{q.text}</span>
                </label>
              )
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 mb-6">
        <Label htmlFor="deviation">Avvik? (valgfritt)</Label>
        <Textarea
          id="deviation"
          value={deviationNote}
          onChange={(e) => setDeviationNote(e.target.value)}
          placeholder="F.eks. tom såpedispenser på lager, ødelagt kran …"
        />
      </div>

      <div className="flex flex-col gap-1.5 mb-6">
        <Label htmlFor="photos">Bilde av avvik (valgfritt, inntil 3)</Label>
        <label
          htmlFor="photos"
          className="flex items-center gap-2 rounded-lg border border-dashed border-input p-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50"
        >
          <ImagePlus className="size-4" />
          {photos.length > 0 ? `${photos.length} fil(er) valgt` : 'Velg filer'}
        </label>
        <input id="photos" type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
        <p className="text-xs text-muted-foreground">
          Bildene vises kun for daglig leder og slettes automatisk etter 30 dager.
        </p>
      </div>

      <div className="flex flex-col gap-1.5 mb-6">
        <Label htmlFor="name">Ditt navn</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fornavn Etternavn" />
      </div>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={submitting || !allChecked}
        className="w-full h-12 text-base bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
      >
        {submitting ? 'Registrerer...' : 'Bekreft rengjort'}
      </Button>
      {!allChecked && (
        <p className="text-center text-xs text-muted-foreground mt-2">Alle sjekkpunkter må hukes av først.</p>
      )}

      <button
        type="button"
        onClick={() => setSelectedRoom(null)}
        className="w-full text-center text-xs text-muted-foreground mt-3 inline-flex items-center justify-center gap-1"
      >
        <X className="size-3" />
        Velg et annet rom
      </button>
    </div>
  )
}
