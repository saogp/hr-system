'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const COUNTRY_CODES = [
  { code: '+47', label: '🇳🇴 +47', digits: 8 },
  { code: '+46', label: '🇸🇪 +46', digits: 9 },
  { code: '+45', label: '🇩🇰 +45', digits: 8 },
  { code: '+44', label: '🇬🇧 +44', digits: 10 },
  { code: '+49', label: '🇩🇪 +49', digits: 11 },
  { code: '+48', label: '🇵🇱 +48', digits: 9 },
  { code: '+370', label: '🇱🇹 +370', digits: 8 },
  { code: '+371', label: '🇱🇻 +371', digits: 8 },
  { code: '+372', label: '🇪🇪 +372', digits: 8 },
  { code: '+1', label: '🇺🇸 +1', digits: 10 },
]

function getExpectedDigits(code: string): number | undefined {
  return COUNTRY_CODES.find((c) => c.code === code)?.digits
}

function formatNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
}

function parsePhone(raw: string | null) {
  if (!raw) return { code: '+47', number: '' }
  const match = raw.match(/^(\+\d{1,3})\s?(.*)$/)
  if (match) return { code: match[1], number: formatNumber(match[2]) }
  return { code: '+47', number: formatNumber(raw) }
}

type Props = {
  value: string | null
  onCommit: (value: string | null) => void
}

export function PhoneInput({ value, onCommit }: Props) {
  const initial = parsePhone(value)
  const [code, setCode] = useState(initial.code)
  const [number, setNumber] = useState(initial.number)

  const digitCount = number.replace(/\D/g, '').length
  const expectedDigits = getExpectedDigits(code)
  const error =
    digitCount > 0 && expectedDigits && digitCount !== expectedDigits
      ? `Telefonnummer med ${code} skal ha ${expectedDigits} siffer (har ${digitCount}).`
      : null

  const commit = (nextCode: string, nextNumber: string) => {
    const trimmed = nextNumber.trim()
    onCommit(trimmed ? `${nextCode} ${trimmed}` : null)
  }

  return (
    <div className="flex flex-col gap-1">
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
          onChange={(e) => setNumber(formatNumber(e.target.value))}
          onBlur={() => commit(code, number)}
          placeholder="Telefonnummer"
          aria-invalid={!!error}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
