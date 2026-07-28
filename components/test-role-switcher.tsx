'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
import { getRoleOverride, setRoleOverride, type Role } from '@/lib/role-override'
import { Button } from '@/components/ui/button'

const ROLES: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Leder' },
  { value: 'employee', label: 'Ansatt' },
]

export function TestRoleSwitcher() {
  const pathname = usePathname()
  const [override, setOverride] = useState<Role | null>(null)

  useEffect(() => {
    setOverride(getRoleOverride())
  }, [])

  if (pathname === '/login' || pathname === '/onboarding') return null

  return (
    <div className="flex items-center gap-2 border-b border-border bg-brand-navy px-4 py-1.5 text-white text-xs overflow-x-auto">
      <FlaskConical className="size-3.5 text-brand-orange shrink-0" />
      <span className="text-white/70 shrink-0">Test-visning:</span>
      {ROLES.map((r) => (
        <button
          key={r.value}
          onClick={() => setRoleOverride(r.value)}
          className={`rounded-full px-2.5 py-0.5 shrink-0 ${
            override === r.value ? 'bg-brand-orange text-brand-navy font-medium' : 'text-white/80 hover:bg-white/10'
          }`}
        >
          {r.label}
        </button>
      ))}
      {override && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-white/70 hover:text-white hover:bg-white/10 shrink-0"
          onClick={() => setRoleOverride(null)}
        >
          Vis faktisk rolle
        </Button>
      )}
    </div>
  )
}
