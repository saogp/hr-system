'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RadarChart } from '@/components/radar-chart'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Person = { id: string; full_name: string | null; email: string | null }
type Competence = { id: string; name: string; target_level: number }

export default function CompetencePage() {
  const router = useRouter()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [competences, setCompetences] = useState<Competence[]>([])
  const [levels, setLevels] = useState<Record<string, Record<string, number>>>({})
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [loading, setLoading] = useState(true)
  const [newCompetenceName, setNewCompetenceName] = useState('')

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/login')
      return
    }
    setCurrentUserId(user.id)
    setSelectedPersonId(user.id)

    const { data: viewerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    setIsAdmin(viewerProfile?.role === 'admin')

    const { data: peopleData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name')
    if (peopleData) setPeople(peopleData)

    const { data: competencesData } = await supabase
      .from('competences')
      .select('id, name, target_level')
      .order('name')
    if (competencesData) setCompetences(competencesData)

    const { data: levelsData } = await supabase
      .from('employee_competences')
      .select('profile_id, competence_id, level')

    if (levelsData) {
      const map: Record<string, Record<string, number>> = {}
      for (const row of levelsData) {
        map[row.profile_id] = { ...(map[row.profile_id] ?? {}), [row.competence_id]: row.level }
      }
      setLevels(map)
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const canEdit = (profileId: string) => isAdmin || currentUserId === profileId

  const handleLevelChange = async (profileId: string, competenceId: string, level: number) => {
    const { error } = await supabase
      .from('employee_competences')
      .upsert({ profile_id: profileId, competence_id: competenceId, level }, { onConflict: 'profile_id,competence_id' })

    if (!error) {
      setLevels(prev => ({
        ...prev,
        [profileId]: { ...(prev[profileId] ?? {}), [competenceId]: level },
      }))
    }
  }

  const handleAddCompetence = async () => {
    if (!newCompetenceName.trim()) return
    const { data, error } = await supabase
      .from('competences')
      .insert({ name: newCompetenceName.trim() })
      .select()
      .single()

    if (!error && data) {
      setCompetences(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'no')))
      setNewCompetenceName('')
    }
  }

  const handleTargetChange = async (competenceId: string, target: number) => {
    const { error } = await supabase
      .from('competences')
      .update({ target_level: target })
      .eq('id', competenceId)

    if (!error) {
      setCompetences(prev => prev.map(c => (c.id === competenceId ? { ...c, target_level: target } : c)))
    }
  }

  const handleDeleteCompetence = async (competenceId: string) => {
    const { error } = await supabase.from('competences').delete().eq('id', competenceId)
    if (!error) {
      setCompetences(prev => prev.filter(c => c.id !== competenceId))
    }
  }

  if (loading) {
    return <div className="p-8">Laster kompetanse...</div>
  }

  const radarAxes = competences.map((c) => ({
    label: c.name,
    value: levels[selectedPersonId]?.[c.id] ?? 0,
    target: c.target_level,
  }))

  return (
    <div className="container mx-auto py-10 px-4 space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Kompetanse</h1>
        <p className="text-muted-foreground text-sm">
          Registrer kompetanse per ansatt og se hvem som har hva.
        </p>
      </div>

      <div>
        <div className="flex flex-row items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Gap-analyse</h2>
          <Select value={selectedPersonId} onValueChange={(val) => val && setSelectedPersonId(val)}>
            <SelectTrigger className="w-56 h-8">
              <SelectValue placeholder="Velg person" />
            </SelectTrigger>
            <SelectContent>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {competences.length < 3 ? (
          <p className="text-sm text-muted-foreground">Legg til minst 3 kompetanser for å vise diagram.</p>
        ) : (
          <RadarChart axes={radarAxes} />
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Oversikt</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Navn</TableHead>
              {competences.map((c) => (
                <TableHead key={c.id}>{c.name}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium whitespace-nowrap">{p.full_name || p.email}</TableCell>
                {competences.map((c) => {
                  const level = levels[p.id]?.[c.id] ?? 0
                  return (
                    <TableCell key={c.id}>
                      {canEdit(p.id) ? (
                        <Select
                          value={String(level)}
                          onValueChange={(val) => val && handleLevelChange(p.id, c.id, Number(val))}
                        >
                          <SelectTrigger className="w-16 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[0, 1, 2, 3, 4, 5].map((n) => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm">{level}</span>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {isAdmin && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Administrer kompetanser</h2>
          <div className="flex items-center gap-2 mb-4">
            <Input
              placeholder="Ny kompetanse..."
              value={newCompetenceName}
              onChange={(e) => setNewCompetenceName(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={handleAddCompetence}>Legg til</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Navn</TableHead>
                <TableHead>Målnivå</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {competences.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Select
                      value={String(c.target_level)}
                      onValueChange={(val) => val && handleTargetChange(c.id, Number(val))}
                    >
                      <SelectTrigger className="w-16 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteCompetence(c.id)}>
                      Slett
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

