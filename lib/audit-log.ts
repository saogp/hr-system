import { supabase } from '@/lib/supabase'

export const AUDIT_ACTIONS = {
  profile_field_updated: 'Endret felt',
  employee_deactivated: 'Deaktiverte ansatt',
  employee_activated: 'Aktiverte ansatt',
  employee_deleted: 'Slettet ansatt',
  company_assigned: 'La til bedrift',
  company_removed: 'Fjernet bedrift',
} as const

export type AuditAction = keyof typeof AUDIT_ACTIONS

export const AUDIT_FIELD_LABELS: Record<string, string> = {
  full_name: 'navn',
  email: 'e-post',
  phone: 'telefonnummer',
  address: 'adresse',
  postal_code: 'postnummer',
  postal_place: 'poststed',
  birth_date: 'bursdag',
  emergency_contact_name: 'nærmeste pårørende',
  emergency_contact_phone: 'pårørendes telefon',
  employee_number: 'ansattnummer',
  title: 'stilling',
  role: 'rolle',
  manager_id: 'nærmeste leder',
  employment_type: 'ansettelsesforhold',
  position_percentage: 'stillingsprosent',
  start_date: 'tiltredelse',
  end_date: 'sluttdato',
  next_review_date: 'neste medarbeidersamtale',
}

export async function logAudit(actorId: string, action: AuditAction, targetProfileId: string | null, details?: Record<string, unknown>) {
  try {
    await supabase.from('audit_log').insert({ actor_id: actorId, action, target_profile_id: targetProfileId, details: details ?? null })
  } catch {
    // best-effort — never block the underlying action
  }
}
