'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const COUNTRY_CODES = [
  { code: '+47', label: '🇳🇴 +47' },
  { code: '+46', label: '🇸🇪 +46' },
  { code: '+45', label: '🇩🇰 +45' },
  { code: '+44', label: '🇬🇧 +44' },
  { code: '+49', label: '🇩🇪 +49' },
  { code: '+48', label: '🇵🇱 +48' },
  { code: '+370', label: '🇱🇹 +370' },
  { code: '+371', label: '🇱🇻 +371' },
  { code: '+372', label: '🇪🇪 +372' },
  { code: '+1', label: '🇺🇸 +1' },
]

function parsePhone(raw: string | null) {
  if (!raw) return { code: '+47', number: '' }
  const match = raw.match(/^(\+\d{1,3})\s?(.*)$/)
  if (match) return { code: match[1], number: match[2] }
  return { code: '+47', number: raw }
}

type Props = {
  value: string | null
  onCommit: (value: string | null) => void
}

export function PhoneInput({ value, onCommit }: Props) {
  const initial = parsePhone(value)
  const [code, setCode] = useState(initial.code)
  const [number, setNumber] = useState(initial.number)

  const commit = (nextCode: string, nextNumber: string) => {
    const trimmed = nextNumber.trim()
    onCommit(trimmed ? `${nextCode} ${trimmed}` : null)
  }

  return (
    <div className="flex gap-2">
      <Select
        value={code}
        onValueChange={(val) => {
          if (!val) return
          setCode(val)
          commit(val, number)
        }}
      >
        <SelectTrigger className="w-24 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map((c) => (
            <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        onBlur={() => commit(code, number)}
        placeholder="Telefonnummer"
      />
    </div>
  )
}
