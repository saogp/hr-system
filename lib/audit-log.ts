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

export async function logAudit(actorId: string, action: AuditAction, targetProfileId: string | null, details?: Record<string, unknown>) {
  try {
    await supabase.from('audit_log').insert({ actor_id: actorId, action, target_profile_id: targetProfileId, details: details ?? null })
  } catch {
    // best-effort — never block the underlying action
  }
}
