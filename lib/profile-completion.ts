export type ProfileCompletionInput = {
  birth_date?: string | null
  phone?: string | null
  address?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  avatar_url?: string | null
}

const FIELDS: { key: keyof ProfileCompletionInput; label: string }[] = [
  { key: 'avatar_url', label: 'Profilbilde' },
  { key: 'birth_date', label: 'Fødselsdato' },
  { key: 'phone', label: 'Telefonnummer' },
  { key: 'address', label: 'Adresse' },
  { key: 'emergency_contact_name', label: 'Nærmeste pårørende' },
  { key: 'emergency_contact_phone', label: 'Pårørendes telefon' },
]

export function computeProfileCompletion(profile: ProfileCompletionInput) {
  const missing = FIELDS.filter((f) => !profile[f.key])
  const percent = Math.round(((FIELDS.length - missing.length) / FIELDS.length) * 100)
  return { percent, missing }
}
