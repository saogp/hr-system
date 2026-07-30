import { SURVEY_CATEGORIES, type SurveyCategory } from '@/lib/survey-categories'

export type ScoredQuestion = {
  id: string
  type?: 'text' | 'scale' | 'heading'
  category?: SurveyCategory
}

function toScore(avg: number): number {
  return Math.round(((avg - 1) / 4) * 100)
}

export function computeResponseScore(
  questions: ScoredQuestion[],
  responses: Record<string, string> | null | undefined
): number | null {
  const values = questions
    .filter((q) => q.type === 'scale')
    .map((q) => responses?.[q.id])
    .filter((v): v is string => Boolean(v))
    .map(Number)

  if (values.length === 0) return null
  return toScore(values.reduce((a, b) => a + b, 0) / values.length)
}

export function computeCategoryScores(
  entries: { questions: ScoredQuestion[]; responses: Record<string, string> | null | undefined }[]
): { overall: number | null; categories: { category: SurveyCategory; label: string; score: number | null }[] } {
  const buckets: Record<string, { total: number; count: number }> = {}
  let overallTotal = 0
  let overallCount = 0

  for (const entry of entries) {
    for (const q of entry.questions) {
      if (q.type !== 'scale') continue
      const raw = entry.responses?.[q.id]
      if (!raw) continue
      const val = Number(raw)
      overallTotal += val
      overallCount += 1

      if (q.category) {
        const bucket = buckets[q.category] ?? { total: 0, count: 0 }
        bucket.total += val
        bucket.count += 1
        buckets[q.category] = bucket
      }
    }
  }

  const categories = SURVEY_CATEGORIES.map(({ value, label }) => {
    const bucket = buckets[value]
    return {
      category: value,
      label,
      score: bucket ? toScore(bucket.total / bucket.count) : null,
    }
  })

  return {
    overall: overallCount > 0 ? toScore(overallTotal / overallCount) : null,
    categories,
  }
}
