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

export function applyRoleOverride(realRole: string): string {
  return getRoleOverride() ?? realRole
}
