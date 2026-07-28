import { supabase } from '@/lib/supabase'
import { clearRoleOverrideSilently } from '@/lib/role-override'

const ORIGINAL_SESSION_KEY = 'zest_original_session'

export function isImpersonating(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(ORIGINAL_SESSION_KEY) !== null
}

export async function startImpersonation(targetUserId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  if (!sessionStorage.getItem(ORIGINAL_SESSION_KEY)) {
    sessionStorage.setItem(
      ORIGINAL_SESSION_KEY,
      JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token })
    )
  }

  const res = await fetch('/api/impersonate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ targetUserId }),
  })

  if (!res.ok) {
    const result = await res.json().catch(() => ({}))
    throw new Error(result.error || 'Kunne ikke bytte bruker.')
  }

  const { tokenHash } = await res.json()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (error) throw error

  // The fake role-preview override lives in localStorage, separate from the
  // real session — clear it so the impersonated account's real role decides
  // what's shown, instead of a stale override left over from before.
  clearRoleOverrideSilently()
  window.location.href = '/'
}

export async function stopImpersonation() {
  const raw = sessionStorage.getItem(ORIGINAL_SESSION_KEY)
  if (!raw) return

  sessionStorage.removeItem(ORIGINAL_SESSION_KEY)
  const { access_token, refresh_token } = JSON.parse(raw)
  await supabase.auth.setSession({ access_token, refresh_token })
  clearRoleOverrideSilently()
  window.location.href = '/'
}
