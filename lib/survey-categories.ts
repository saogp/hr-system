export const SURVEY_CATEGORIES = [
  { value: 'trivsel', label: 'Trivsel' },
  { value: 'ledelse', label: 'Ledelse' },
  { value: 'samarbeid', label: 'Samarbeid' },
  { value: 'utvikling', label: 'Utvikling' },
  { value: 'arbeidsforhold', label: 'Arbeidsforhold' },
  { value: 'anerkjennelse', label: 'Anerkjennelse' },
] as const

export type SurveyCategory = (typeof SURVEY_CATEGORIES)[number]['value']

export function categoryLabel(value: string): string {
  return SURVEY_CATEGORIES.find((c) => c.value === value)?.label ?? value
}
