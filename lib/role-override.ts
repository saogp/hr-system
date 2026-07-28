export type Role = 'admin' | 'manager' | 'employee'

const KEY = 'hr_role_override'

export function getRoleOverride(): Role | null {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(KEY)
  return v === 'admin' || v === 'manager' || v === 'employee' ? v : null
}

export function setRoleOverride(role: Role | null) {
  if (typeof window === 'undefined') return
  if (role) {
    window.localStorage.setItem(KEY, role)
  } else {
    window.localStorage.removeItem(KEY)
  }
  window.location.reload()
}

// Clears the role override without reloading — for callers (like impersonation)
// that are about to navigate/reload themselves right after.
export function clearRoleOverrideSilently() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(KEY)
}

export function applyRoleOverride(realRole: string): string {
  return getRoleOverride() ?? realRole
}

// Managers get the same view/create/edit access as admin everywhere;
// only destructive (delete) actions remain admin-only. Use this for
// general access gates, and check `role === 'admin'` directly for deletes.
export function isAdminLike(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'manager'
}
