import { HardHat, Shirt, Footprints, IdCard, IdCardLanyard, Package, type LucideIcon } from 'lucide-react'

export const UNIFORM_TYPES = ['Caps', 'Skjorte', 'T-skjorte', 'Forkle', 'Sko', 'Adgangskort', 'Personalkort'] as const

export const UNIFORM_SIZES = ['Ingen', 'XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

const UNIFORM_TYPE_ICONS: Record<string, LucideIcon> = {
  'Caps': HardHat,
  'Skjorte': Shirt,
  'T-skjorte': Shirt,
  'Forkle': Shirt,
  'Sko': Footprints,
  'Adgangskort': IdCard,
  'Personalkort': IdCardLanyard,
}

export function getUniformTypeIcon(type: string): LucideIcon {
  return UNIFORM_TYPE_ICONS[type] ?? Package
}

export const CARD_CREDENTIAL_TYPES: readonly string[] = ['Adgangskort']

export function needsCardCredentials(type: string): boolean {
  return CARD_CREDENTIAL_TYPES.includes(type)
}

export type IssuanceItem = {
  id: string
  type: string
  size: string
  quantity: number
  card_number: string | null
  card_password: string | null
  returned: boolean
  returned_at: string | null
}

export type UniformIssuance = {
  id: string
  profile_id: string
  company_id: string | null
  created_by: string | null
  items: IssuanceItem[]
  send_email: boolean
  employee_signed_at: string | null
  employee_signature: string | null
  created_at: string
}

export function summarizeItems(items: IssuanceItem[]): string {
  return items
    .map((i) => {
      if (needsCardCredentials(i.type)) {
        return `${i.type}${i.card_number ? ` (nr. ${i.card_number})` : ''}`
      }
      return `${i.type}${i.size !== 'Ingen' ? ` (${i.size})` : ''}${i.quantity > 1 ? ` x${i.quantity}` : ''}`
    })
    .join(', ')
}
