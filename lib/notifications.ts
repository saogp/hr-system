import { supabase } from '@/lib/supabase'

export const NOTIFICATION_TYPES = {
  contract_signed: 'Kontrakt signert',
  survey_answered: 'Undersøkelse besvart',
  si_fra_submitted: 'Ny si fra-melding',
  review_completed: 'Medarbeidersamtale fullført',
  uniform_confirmed: 'Personalutstyr bekreftet',
  cleaning_daily_summary: 'Renhold – daglig oppsummering',
} as const

export type NotificationType = keyof typeof NOTIFICATION_TYPES

export type NotificationChannelPrefs = { email?: boolean; push?: boolean }
export type NotificationPrefs = Partial<Record<NotificationType, NotificationChannelPrefs>>

export async function sendNotification(params: {
  recipientId?: string
  recipientRole?: 'admin' | 'manager'
  type: NotificationType
  title: string
  body?: string
  link?: string
}) {
  const { data: { session } } = await supabase.auth.getSession()
  try {
    await fetch('/api/notifications/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify(params),
    })
  } catch {
    // Notifications are best-effort — never block the underlying action.
  }
}
