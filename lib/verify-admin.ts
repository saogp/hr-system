import { supabaseAdmin } from '@/lib/supabase-admin'

export async function verifyAdminRequest(request: Request) {
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

  if (caller?.role !== 'admin') {
    return { error: 'Kun admin har tilgang.', status: 403 } as const
  }

  return { user }
}
