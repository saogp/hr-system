export const RESERVED_TOKENS = {
  navn: 'full_name',
  epost: 'email',
  fodselsdato: 'birth_date',
  adresse: 'address',
  telefon: 'phone',
  kontonummer: 'bank_account',
} as const

export type ProfileFields = {
  full_name: string | null
  email: string | null
  birth_date: string | null
  address: string | null
  phone: string | null
  bank_account: string | null
}

const TOKEN_PATTERN = /\{\{\s*([a-zA-ZæøåÆØÅ0-9_]+)\s*\}\}/g

export function extractTokens(content: string): string[] {
  const tokens = new Set<string>()
  for (const match of content.matchAll(TOKEN_PATTERN)) {
    tokens.add(match[1])
  }
  return Array.from(tokens)
}

export function getAdminTokens(content: string): string[] {
  return extractTokens(content).filter((t) => !(t in RESERVED_TOKENS))
}

export function getMissingProfileFields(content: string, profile: ProfileFields): string[] {
  return extractTokens(content)
    .filter((t) => t in RESERVED_TOKENS)
    .filter((t) => !profile[RESERVED_TOKENS[t as keyof typeof RESERVED_TOKENS]])
}

export function renderContract(
  content: string,
  profile: ProfileFields,
  adminFields: Record<string, string>
): string {
  return content.replace(TOKEN_PATTERN, (_match, token: string) => {
    if (token in RESERVED_TOKENS) {
      const value = profile[RESERVED_TOKENS[token as keyof typeof RESERVED_TOKENS]]
      return value || `[${token}]`
    }
    return adminFields[token] || `[${token}]`
  })
}
