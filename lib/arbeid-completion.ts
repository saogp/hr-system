export type ArbeidCompletionInput = {
  title?: string | null
  employment_type?: string | null
  position_percentage?: number | null
  start_date?: string | null
}

const FIELDS: { key: keyof ArbeidCompletionInput; label: string }[] = [
  { key: 'title', label: 'Stilling' },
  { key: 'employment_type', label: 'Ansettelsesforhold' },
  { key: 'position_percentage', label: 'Stillingsprosent' },
  { key: 'start_date', label: 'Tiltredelse' },
]

export function computeArbeidCompletion(profile: ArbeidCompletionInput, hasCompany: boolean) {
  const missing = FIELDS.filter((f) => profile[f.key] === null || profile[f.key] === undefined || profile[f.key] === '')
    .map((f) => f.label)
  if (!hasCompany) missing.push('Bedrift')
  return { missing, complete: missing.length === 0 }
}
