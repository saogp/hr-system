'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function OnboardingPage() {
  const [checkingSession, setCheckingSession] = useState(true)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      setCheckingSession(false)
    }
    checkSession()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (password.length < 6) {
      setErrorMsg('Passordet må være minst 6 tegn.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passordene er ikke like.')
      return
    }
    if (!birthDate) {
      setErrorMsg('Bursdag er påkrevd.')
      return
    }

    setLoading(true)

    const { data: { user }, error: passwordError } = await supabase.auth.updateUser({ password })
    if (passwordError || !user) {
      setErrorMsg(passwordError?.message || 'Kunne ikke sette passord.')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ birth_date: birthDate })
      .eq('id', user.id)

    if (profileError) {
      setErrorMsg(profileError.message)
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  if (checkingSession) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Laster...</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm shadow-none border-border">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Fullfør kontoen din</CardTitle>
          <CardDescription>
            Sett et passord og fyll inn bursdagen din for å komme i gang.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="grid gap-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="password">Nytt passord</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Bekreft passord</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="birth-date">Bursdag</Label>
              <Input
                id="birth-date"
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Lagrer...' : 'Fullfør'}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
