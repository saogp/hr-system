'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
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

  if (pathname === '/login' || pathname === '/onboarding') return null
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
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-brand-navy px-4 py-1.5 text-white text-xs overflow-x-auto">
      <FlaskConical className="size-3.5 text-brand-orange shrink-0" />

      {impersonating ? (
        <>
          <span className="text-white/70 shrink-0">Du ser som:</span>
          <span className="rounded-full bg-brand-orange px-2.5 py-0.5 font-medium text-brand-navy shrink-0">
            {currentName || 'Ukjent bruker'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-white/70 hover:text-white hover:bg-white/10 shrink-0"
            onClick={handleStop}
            disabled={switching}
          >
            Avslutt
          </Button>
        </>
      ) : (
        <>
          <span className="text-white/70 shrink-0">Bytt bruker:</span>
          <Select value="" onValueChange={(val) => val && handleSwitchUser(val)}>
            <SelectTrigger className="h-6 w-44 border-white/20 bg-white/5 text-white text-xs [&_svg]:text-white/70">
              <SelectValue placeholder={switching ? 'Bytter...' : 'Velg person'} />
            </SelectTrigger>
            <SelectContent>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {switchError && <span className="text-red-300 shrink-0">{switchError}</span>}
        </>
      )}
    </div>
  )
}
