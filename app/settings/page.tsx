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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Company = {
  id: string
  name: string
}

type Profile = {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'manager' | 'employee'
  company_id: string | null
}

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(false)
    // Hent bedrifter
    const { data: compData } = await supabase.from('companies').select('*')
    if (compData) setCompanies(compData)

    // Hent profiler/ansatte
    const { data: profData } = await supabase.from('profiles').select('*')
    if (profData) setProfiles(profData)

    setLoading(false)
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

  const handleCompanyChange = async (userId: string, companyId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ company_id: companyId })
      .eq('id', userId)

    if (!error) {
      setProfiles(prev =>
        prev.map(p => (p.id === userId ? { ...p, company_id: companyId } : p))
      )
    }
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

  if (loading) {
    return <div className="p-8">Laster innstillinger...</div>
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <Card className="shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Innstillinger & Tilganger</CardTitle>
          <CardDescription>
            Administrer ansatte, roller og hvilken bedrift de er knyttet til.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-post</TableHead>
                <TableHead>Navn</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Bedrift</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Ingen ansatte registrert enda.
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.full_name || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRoleBadge(user.role)}
                        <Select
                          value={user.role}
                          onValueChange={(val) => handleRoleChange(user.id, val)}
                        >
                          <SelectTrigger className="w-[120px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Leder</SelectItem>
                            <SelectItem value="employee">Ansatt</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.company_id || ''}
                        onValueChange={(val) => handleCompanyChange(user.id, val)}
                      >
                        <SelectTrigger className="w-[200px] h-8">
                          <SelectValue placeholder="Velg bedrift" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}