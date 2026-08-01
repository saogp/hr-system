'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { startImpersonation, stopImpersonation, isImpersonating } from '@/lib/impersonation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type PersonOption = { id: string; full_name: string | null; email: string | null }

export function TestRoleSwitcher() {
  const pathname = usePathname()
  const [impersonating, setImpersonating] = useState(false)
  const [currentName, setCurrentName] = useState('')
  const [people, setPeople] = useState<PersonOption[]>([])
  const [switching, setSwitching] = useState(false)
  const [switchError, setSwitchError] = useState('')

  useEffect(() => {
    setImpersonating(isImpersonating())

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, role')
        .eq('id', user.id)
        .single()
      setCurrentName(profile?.full_name || profile?.email || '')

      if (profile?.role === 'admin') {
        const { data: peopleData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .neq('id', user.id)
          .order('full_name')
        if (peopleData) setPeople(peopleData)
      }
    }
    load()
  }, [])

  if (pathname === '/login' || pathname === '/onboarding' || pathname.startsWith('/renhold/gruppe')) return null
  if (!impersonating && people.length === 0) return null

  const handleSwitchUser = async (targetUserId: string) => {
    setSwitching(true)
    setSwitchError('')
    try {
      await startImpersonation(targetUserId)
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : 'Kunne ikke bytte bruker.')
      setSwitching(false)
    }
  }

  const handleStop = async () => {
    setSwitching(true)
    await stopImpersonation()
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1">
      {impersonating ? (
        <>
          <span className="rounded-full bg-brand-orange px-2.5 py-0.5 text-xs font-medium text-brand-navy truncate">
            {currentName || 'Ukjent bruker'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleStop}
            disabled={switching}
          >
            Avslutt
          </Button>
        </>
      ) : (
        <>
          <Select value="" onValueChange={(val) => val && handleSwitchUser(val)}>
            <SelectTrigger className="h-auto w-auto justify-start gap-1 border-0 bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-foreground dark:bg-transparent dark:hover:bg-transparent [&_span]:text-[12px]">
              <SelectValue placeholder={switching ? 'Bytter...' : 'Velg person'} />
            </SelectTrigger>
            <SelectContent>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-[12px]">
                  {p.full_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {switchError && <span className="text-xs text-destructive">{switchError}</span>}
        </>
      )}
    </div>
  )
}
