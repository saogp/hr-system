export const RESERVED_TOKENS = {
  navn: 'full_name',
  epost: 'email',
  fodselsdato: 'birth_date',
  adresse: 'address',
  telefon: 'phone',
  kontonummer: 'bank_account',
  stilling: 'title',
} as const

export const COMPANY_TOKENS = {
  firma_navn: 'name',
  org_nummer: 'org_number',
  firma_adresse: 'billing_address',
} as const

export type ProfileFields = {
  full_name: string | null
  email: string | null
  birth_date: string | null
  address: string | null
  phone: string | null
  bank_account: string | null
  title: string | null
}

export type CompanyFields = {
  name: string | null
  org_number: string | null
  billing_address: string | null
}

export type ChoiceField = {
  key: string
  optionA: string
  optionB: string
}

const TOKEN_PATTERN = /\{\{\s*([a-zA-ZæøåÆØÅ0-9_]+)\s*\}\}/g
const CHOICE_PATTERN = /\{\{choice:([a-zA-ZæøåÆØÅ0-9_]+):([^|{}]+)\|([^{}]+)\}\}/g

export function extractTokens(content: string): string[] {
  const tokens = new Set<string>()
  for (const match of content.matchAll(TOKEN_PATTERN)) {
    tokens.add(match[1])
  }
  return Array.from(tokens)
}

export function extractChoiceFields(content: string): ChoiceField[] {
  const fields: ChoiceField[] = []
  const seen = new Set<string>()
  for (const match of content.matchAll(CHOICE_PATTERN)) {
    const [, key, optionA, optionB] = match
    if (!seen.has(key)) {
      seen.add(key)
      fields.push({ key, optionA: optionA.trim(), optionB: optionB.trim() })
    }
  }
  return fields
}

export function getAdminTokens(content: string): string[] {
  return extractTokens(content).filter(
    (t) => !(t in RESERVED_TOKENS) && !(t in COMPANY_TOKENS)
  )
}

export function usesCompanyTokens(content: string): boolean {
  return extractTokens(content).some((t) => t in COMPANY_TOKENS)
}

export function getMissingProfileFields(content: string, profile: ProfileFields): string[] {
  return extractTokens(content)
    .filter((t) => t in RESERVED_TOKENS)
    .filter((t) => !profile[RESERVED_TOKENS[t as keyof typeof RESERVED_TOKENS]])
}

export function renderContract(
  content: string,
  profile: ProfileFields,
  adminFields: Record<string, string>,
  company?: CompanyFields | null
): string {
  let result = content.replace(CHOICE_PATTERN, (_match, key: string, optionA: string, optionB: string) => {
    return adminFields[key] || optionA.trim() || `[${key}]`
  })

  result = result.replace(TOKEN_PATTERN, (_match, token: string) => {
    if (token in RESERVED_TOKENS) {
      const value = profile[RESERVED_TOKENS[token as keyof typeof RESERVED_TOKENS]]
      return value || `[${token}]`
    }
    if (token in COMPANY_TOKENS) {
      const value = company?.[COMPANY_TOKENS[token as keyof typeof COMPANY_TOKENS]]
      return value || `[${token}]`
    }
    return adminFields[token] || `[${token}]`
  })

  return result
}
