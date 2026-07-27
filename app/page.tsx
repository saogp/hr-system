'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type MyContract = {
  id: string
  sent_at: string
  confirmed_at: string | null
  contract_templates: { name: string } | null
}

export default function DashboardPage() {
  const [userName, setUserName] = useState<string>('')
  const [role, setRole] = useState<string>('Laster...')
  const [loading, setLoading] = useState(true)
  const [myContracts, setMyContracts] = useState<MyContract[]>([])
  const router = useRouter()

  useEffect(() => {
    async function getUserData() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle()

      if (profile && profile.full_name) {
        setUserName(profile.full_name)
        setRole(profile.role)
      } else {
        setUserName(user.email || 'Ansatt')
        setRole(profile?.role || 'admin')
      }

      const { data: contractsData } = await supabase
        .from('contracts')
        .select('id, sent_at, confirmed_at, contract_templates!contracts_template_id_fkey(name)')
        .eq('profile_id', user.id)
        .order('sent_at', { ascending: false })

      if (contractsData) setMyContracts(contractsData as unknown as MyContract[])

      setLoading(false)
    }

    getUserData()
  }, [router])

  if (loading) {
    return <div className="p-8 text-center">Laster inn dashbord...</div>
  }

  return (
    <div className="p-8 space-y-6">
      <Card className="shadow-none border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold">God dag, {userName}</CardTitle>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-muted-foreground">Rolle:</span>
            <Badge className="capitalize">{role}</Badge>
          </div>
        </CardHeader>
      </Card>

      <Card className="shadow-none border-border">
        <CardContent className="pt-6">
          <p className="text-muted-foreground">
            Velkommen til HR-portalen! Her skal vi bygge dashbordet med bursdager, dokumenter og undersøkelser.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Mine kontrakter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {myContracts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Du har ingen kontrakter enda.</p>
          ) : (
            myContracts.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium">{c.contract_templates?.name || '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    Sendt {new Date(c.sent_at).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {c.confirmed_at ? (
                    <Badge className="bg-green-600 hover:bg-green-700">Bekreftet</Badge>
                  ) : (
                    <Badge variant="secondary">Venter</Badge>
                  )}
                  <Button variant="ghost" size="sm" render={<Link href={`/contracts/${c.id}`} />}>
                    Åpne
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}