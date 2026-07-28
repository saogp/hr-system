'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setInfoMsg('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMsg('Feil e-post eller passord. Prøv igjen.')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMsg('Skriv inn e-posten din over først.')
      return
    }
    setResetting(true)
    setErrorMsg('')
    setInfoMsg('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`,
    })

    if (error) {
      setErrorMsg(error.message)
    } else {
      setInfoMsg('Sjekk e-posten din for en lenke til å tilbakestille passordet.')
    }
    setResetting(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm shadow-none border-border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-bold">Logg inn</CardTitle>
          <CardDescription>
            Skriv inn e-posten din for å logge inn på kontoen din
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleLogin}>
          <CardContent className="grid gap-4">
            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}
            {infoMsg && (
              <Alert>
                <AlertDescription>{infoMsg}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                placeholder="navn@firma.no"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Passord</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Skjul passord' : 'Vis passord'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Logger inn...' : 'Logg inn'}
            </Button>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetting}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline text-center"
            >
              {resetting ? 'Sender...' : 'Glemt passord?'}
            </button>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
