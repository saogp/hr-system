import { supabaseAdmin } from '@/lib/supabase-admin'

async function isSuperAdmin(callerId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.from('profiles').select('is_super_admin').eq('id', callerId).single()
  return !!data?.is_super_admin
}

export async function callerHasCompanyAccess(callerId: string, companyId: string | null | undefined): Promise<boolean> {
  if (!companyId) return true
  if (await isSuperAdmin(callerId)) return true
  const { data } = await supabaseAdmin
    .from('profile_companies')
    .select('company_id')
    .eq('profile_id', callerId)
    .eq('company_id', companyId)
    .maybeSingle()
  return !!data
}

// Returns null for a super-admin (no filtering needed — sees everyone).
// Otherwise returns the set of profile ids the caller may see: anyone
// sharing a company with them, plus profiles with zero company links yet
// (bootstrap case — newly invited, not yet assigned), matching the
// mgr_select_profiles RLS policy.
export async function getVisibleProfileIds(callerId: string): Promise<Set<string> | null> {
  if (await isSuperAdmin(callerId)) return null

  const { data: myLinks } = await supabaseAdmin.from('profile_companies').select('company_id').eq('profile_id', callerId)
  const myCompanyIds = (myLinks ?? []).map((r) => r.company_id)

  const { data: allLinks } = await supabaseAdmin.from('profile_companies').select('profile_id, company_id')
  const linkedProfileIds = new Set((allLinks ?? []).map((r) => r.profile_id))
  const visible = new Set(
    (allLinks ?? []).filter((r) => myCompanyIds.includes(r.company_id)).map((r) => r.profile_id)
  )

  const { data: allProfiles } = await supabaseAdmin.from('profiles').select('id')
  for (const p of allProfiles ?? []) {
    if (!linkedProfileIds.has(p.id)) visible.add(p.id)
  }

  return visible
}

export async function callerSharesCompanyWith(callerId: string, targetProfileId: string): Promise<boolean> {
  if (callerId === targetProfileId) return true
  if (await isSuperAdmin(callerId)) return true
  const [{ data: mine }, { data: theirs }] = await Promise.all([
    supabaseAdmin.from('profile_companies').select('company_id').eq('profile_id', callerId),
    supabaseAdmin.from('profile_companies').select('company_id').eq('profile_id', targetProfileId),
  ])
  const mineSet = new Set((mine ?? []).map((r) => r.company_id))
  return (theirs ?? []).some((r) => mineSet.has(r.company_id))
}
