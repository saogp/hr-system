'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Person = { id: string; full_name: string | null; email: string | null }

type Question = { id: string; text: string }

type SurveyRow = {
  id: string
  title: string
  created_at: string
}

type MySurveyRow = {
  id: string
  survey_id: string
  submitted_at: string | null
  surveys: { title: string } | null
}

export default function SurveysPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [surveys, setSurveys] = useState<SurveyRow[]>([])
  const [surveyCounts, setSurveyCounts] = useState<Record<string, { total: number; submitted: number }>>({})
  const [mySurveys, setMySurveys] = useState<MySurveyRow[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<Question[]>([{ id: 'q1', text: '' }])
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])

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
    const admin = viewerProfile?.role === 'admin'
    setIsAdmin(admin)

    if (admin) {
      const { data: peopleData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name')
      if (peopleData) setPeople(peopleData)

      const { data: surveysData } = await supabase
        .from('surveys')
        .select('id, title, created_at')
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
        .select('id, survey_id, submitted_at, surveys!survey_recipients_survey_id_fkey(title)')
        .eq('profile_id', user.id)
        .order('id')
      if (mySurveysData) setMySurveys(mySurveysData as unknown as MySurveyRow[])
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const addQuestion = () => {
    setQuestions(prev => [...prev, { id: `q${prev.length + 1}`, text: '' }])
  }

  const updateQuestion = (index: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => (i === index ? { ...q, text } : q)))
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

    const { data: survey, error } = await supabase
      .from('surveys')
      .insert({ title, questions: cleanQuestions })
      .select()
      .single()

    if (!error && survey) {
      await supabase.from('survey_recipients').insert(
        selectedRecipients.map((profileId) => ({ survey_id: survey.id, profile_id: profileId }))
      )

      setCreateOpen(false)
      setTitle('')
      setQuestions([{ id: 'q1', text: '' }])
      setSelectedRecipients([])
      load()
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) {
    return <div className="p-8">Laster undersøkelser...</div>
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Undersøkelser</h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? 'Send undersøkelser til ansatte om hvordan de jobber.' : 'Dine undersøkelser.'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)} disabled={people.length === 0}>
            Ny undersøkelse
          </Button>
        )}
      </div>

      {isAdmin ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tittel</TableHead>
              <TableHead>Opprettet</TableHead>
              <TableHead>Svar</TableHead>
              <TableHead className="text-right">Handling</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {surveys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Ingen undersøkelser sendt enda.
                </TableCell>
              </TableRow>
            ) : (
              surveys.map((s) => {
                const counts = surveyCounts[s.id] ?? { total: 0, submitted: 0 }
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.title}</TableCell>
                    <TableCell>{formatDate(s.created_at)}</TableCell>
                    <TableCell>{counts.submitted} av {counts.total}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" render={<Link href={`/surveys/${s.id}`} />}>
                        Åpne
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tittel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Handling</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mySurveys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Ingen undersøkelser enda.
                </TableCell>
              </TableRow>
            ) : (
              mySurveys.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.surveys?.title || '—'}</TableCell>
                  <TableCell>
                    {s.submitted_at ? (
                      <Badge className="bg-green-600 hover:bg-green-700">Besvart</Badge>
                    ) : (
                      <Badge variant="secondary">Venter</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" render={<Link href={`/surveys/${s.survey_id}`} />}>
                      Åpne
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny undersøkelse</DialogTitle>
            <DialogDescription>Skriv spørsmål og velg hvem som skal motta undersøkelsen.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="survey-title">Tittel</Label>
              <Input id="survey-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Spørsmål</Label>
              {questions.map((q, i) => (
                <div key={q.id} className="flex items-center gap-2">
                  <Input
                    value={q.text}
                    onChange={(e) => updateQuestion(i, e.target.value)}
                    placeholder="Skriv et spørsmål..."
                  />
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

            <DialogFooter>
              <Button type="submit" disabled={!title || selectedRecipients.length === 0}>
                Send undersøkelse
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
