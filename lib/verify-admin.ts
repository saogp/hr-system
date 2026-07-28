import { supabaseAdmin } from '@/lib/supabase-admin'

async function verifyRequest(request: Request, allowedRoles: string[]) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return { error: 'Ikke innlogget.', status: 401 } as const
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return { error: 'Ikke innlogget.', status: 401 } as const
  }

  const { data: caller } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!caller?.role || !allowedRoles.includes(caller.role)) {
    return { error: 'Du har ikke tilgang til dette.', status: 403 } as const
  }

  return { user }
}

export async function verifyAdminRequest(request: Request) {
  return verifyRequest(request, ['admin'])
}

export async function verifyAdminOrManagerRequest(request: Request) {
  return verifyRequest(request, ['admin', 'manager'])
}
