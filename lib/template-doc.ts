import type { JSONContent } from '@tiptap/core'
import { RESERVED_TOKENS, COMPANY_TOKENS } from '@/lib/contract-tokens'

export const FIELD_LABELS: Record<string, string> = {
  navn: 'Navn',
  epost: 'E-post',
  fodselsdato: 'Fødselsdato',
  adresse: 'Adresse',
  telefon: 'Telefon',
  kontonummer: 'Kontonummer',
  stilling: 'Stilling',
  firma_navn: 'Firmanavn',
  org_nummer: 'Org.nummer',
  firma_adresse: 'Firmaadresse',
}

export function labelForToken(token: string): string {
  return FIELD_LABELS[token] ?? token
}

export const EMPLOYEE_FIELDS = Object.keys(RESERVED_TOKENS)
export const COMPANY_FIELDS = Object.keys(COMPANY_TOKENS)

const LINE_PATTERN = /\{\{choice:([a-zA-ZæøåÆØÅ0-9_]+):([^|{}]+)\|([^{}]+)\}\}|\{\{\s*([a-zA-ZæøåÆØÅ0-9_]+)\s*\}\}/g

function parseLineToInline(line: string): JSONContent[] {
  const nodes: JSONContent[] = []
  let lastIndex = 0

  for (const match of line.matchAll(LINE_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      nodes.push({ type: 'text', text: line.slice(lastIndex, index) })
    }

    const [, choiceKey, optionA, optionB, simpleToken] = match
    if (choiceKey) {
      nodes.push({
        type: 'choiceField',
        attrs: { key: choiceKey, optionA: optionA.trim(), optionB: optionB.trim() },
      })
    } else if (simpleToken) {
      nodes.push({ type: 'mergeField', attrs: { token: simpleToken } })
    }

    lastIndex = index + match[0].length
  }

  if (lastIndex < line.length) {
    nodes.push({ type: 'text', text: line.slice(lastIndex) })
  }

  return nodes
}

const HEADING_PATTERN = /^(#{1,2})\s(.*)$/

export function contentToDoc(content: string): JSONContent {
  const lines = content.length > 0 ? content.split('\n') : ['']
  return {
    type: 'doc',
    content: lines.map((line) => {
      const headingMatch = line.match(HEADING_PATTERN)
      const level = headingMatch ? headingMatch[1].length : null
      const rest = headingMatch ? headingMatch[2] : line
      const inline = parseLineToInline(rest)
      const type = level ? 'heading' : 'paragraph'
      const attrs = level ? { level } : undefined
      return inline.length > 0 ? { type, attrs, content: inline } : { type, attrs }
    }),
  }
}

export function docToContent(doc: JSONContent): string {
  const lines: string[] = []

  for (const node of doc.content ?? []) {
    if (node.type !== 'paragraph' && node.type !== 'heading') continue
    let line = ''
    for (const child of node.content ?? []) {
      if (child.type === 'text') {
        line += child.text ?? ''
      } else if (child.type === 'mergeField') {
        line += `{{${child.attrs?.token}}}`
      } else if (child.type === 'choiceField') {
        line += `{{choice:${child.attrs?.key}:${child.attrs?.optionA}|${child.attrs?.optionB}}}`
      }
    }
    if (node.type === 'heading') {
      const level = Number(node.attrs?.level) || 1
      line = `${'#'.repeat(level)} ${line}`
    }
    lines.push(line)
  }

  return lines.join('\n')
}
