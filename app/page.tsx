'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function DashboardPage() {
  const [userName, setUserName] = useState<string>('')
  const [role, setRole] = useState<string>('Laster...')
  const [loading, setLoading] = useState(true)
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
    </div>
  )
}