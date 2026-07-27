'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Company = {
  id: string
  name: string
}

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  role: 'admin' | 'manager' | 'employee'
  birth_date: string | null
}

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [profileCompanyIds, setProfileCompanyIds] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    // Hent bedrifter
    const { data: compData } = await supabase.from('companies').select('*')
    if (compData) setCompanies(compData)

    // Hent profiler/ansatte
    const { data: profData } = await supabase.from('profiles').select('*')
    if (profData) setProfiles(profData)

    // Hent hvilke bedrifter hver ansatt jobber på
    const { data: pcData } = await supabase.from('profile_companies').select('*')
    if (pcData) {
      const map: Record<string, string[]> = {}
      for (const row of pcData as { profile_id: string; company_id: string }[]) {
        map[row.profile_id] = [...(map[row.profile_id] ?? []), row.company_id]
      }
      setProfileCompanyIds(map)
    }

    setLoading(false)
  }

  const handleNameChange = async (userId: string, newName: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: newName })
      .eq('id', userId)

    if (!error) {
      setProfiles(prev =>
        prev.map(p => (p.id === userId ? { ...p, full_name: newName } : p))
      )
    }
  }

  const handleEmailChange = async (userId: string, newEmail: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ email: newEmail })
      .eq('id', userId)

    if (!error) {
      setProfiles(prev =>
        prev.map(p => (p.id === userId ? { ...p, email: newEmail } : p))
      )
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (!error) {
      setProfiles(prev =>
        prev.map(p => (p.id === userId ? { ...p, role: newRole as Profile['role'] } : p))
      )
    }
  }

  const handleToggleCompany = async (userId: string, companyId: string, checked: boolean) => {
    if (checked) {
      const { error } = await supabase
        .from('profile_companies')
        .insert({ profile_id: userId, company_id: companyId })

      if (!error) {
        setProfileCompanyIds(prev => ({
          ...prev,
          [userId]: [...(prev[userId] ?? []), companyId],
        }))
      }
    } else {
      const { error } = await supabase
        .from('profile_companies')
        .delete()
        .eq('profile_id', userId)
        .eq('company_id', companyId)

      if (!error) {
        setProfileCompanyIds(prev => ({
          ...prev,
          [userId]: (prev[userId] ?? []).filter(id => id !== companyId),
        }))
      }
    }
  }

  const handleBirthDateChange = async (userId: string, newDate: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ birth_date: newDate || null })
      .eq('id', userId)

    if (!error) {
      setProfiles(prev =>
        prev.map(p => (p.id === userId ? { ...p, birth_date: newDate || null } : p))
      )
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setInviteError('')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ email: newEmail, full_name: newName }),
    })
    const result = await res.json()

    if (!res.ok) {
      setInviteError(result.error || 'Noe gikk galt.')
    } else {
      setAddOpen(false)
      setNewName('')
      setNewEmail('')
      fetchData()
    }
    setInviting(false)
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-red-500 hover:bg-red-600">Admin</Badge>
      case 'manager':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Leder</Badge>
      default:
        return <Badge variant="secondary">Ansatt</Badge>
    }
  }

  const getCompanyNames = (userId: string) => {
    const ids = profileCompanyIds[userId] ?? []
    if (ids.length === 0) return '—'
    return ids
      .map(id => companies.find(c => c.id === id)?.name)
      .filter(Boolean)
      .join(', ')
  }

  if (loading) {
    return <div className="p-8">Laster innstillinger...</div>
  }

  const editingUser = profiles.find(p => p.id === editingUserId) ?? null

  return (
    <div className="container mx-auto py-10 px-4">
      <Card className="shadow-none border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">Innstillinger</CardTitle>
            <CardDescription>
              Administrer ansatte, roller og hvilken bedrift de er knyttet til.
            </CardDescription>
          </div>
          <Button onClick={() => setAddOpen(true)}>Legg til ansatt</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-post</TableHead>
                <TableHead>Navn</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Bedrift</TableHead>
                <TableHead className="text-right">Handling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Ingen ansatte registrert enda.
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email || '—'}</TableCell>
                    <TableCell>{user.full_name || '—'}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>{getCompanyNames(user.id)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingUserId(user.id)}
                      >
                        Rediger
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet
        open={editingUser !== null}
        onOpenChange={(open) => !open && setEditingUserId(null)}
      >
        {editingUser && (
          <SheetContent key={editingUser.id}>
            <SheetHeader>
              <SheetTitle>{editingUser.full_name || editingUser.email || 'Ansatt'}</SheetTitle>
              <SheetDescription>
                Rediger roller, tilganger og informasjon for denne ansatte.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="full_name">Navn</Label>
                <Input
                  id="full_name"
                  defaultValue={editingUser.full_name ?? ''}
                  onBlur={(e) => handleNameChange(editingUser.id, e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-post</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={editingUser.email ?? ''}
                  onBlur={(e) => handleEmailChange(editingUser.id, e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Rolle</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(val) => val && handleRoleChange(editingUser.id, val)}
                >
                  <SelectTrigger className="w-full h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Leder</SelectItem>
                    <SelectItem value="employee">Ansatt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Bedrifter</Label>
                <div className="flex flex-col gap-2 rounded-md border border-input p-3">
                  {companies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ingen bedrifter registrert enda.</p>
                  ) : (
                    companies.map((c) => {
                      const checked = (profileCompanyIds[editingUser.id] ?? []).includes(c.id)
                      const checkboxId = `company-${editingUser.id}-${c.id}`
                      return (
                        <div key={c.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            id={checkboxId}
                            checked={checked}
                            onCheckedChange={(val) =>
                              handleToggleCompany(editingUser.id, c.id, val === true)
                            }
                          />
                          <Label htmlFor={checkboxId} className="font-normal">
                            {c.name}
                          </Label>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="birth_date">Bursdag</Label>
                <Input
                  id="birth_date"
                  type="date"
                  defaultValue={editingUser.birth_date ?? ''}
                  onChange={(e) => handleBirthDateChange(editingUser.id, e.target.value)}
                />
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Legg til ansatt</DialogTitle>
            <DialogDescription>
              Sender en e-postinvitasjon der den ansatte kan sette sitt eget passord.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="flex flex-col gap-4">
            {inviteError && (
              <Alert variant="destructive">
                <AlertDescription>{inviteError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-name">Navn</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-email">E-post</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={inviting}>
                {inviting ? 'Sender invitasjon...' : 'Send invitasjon'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
