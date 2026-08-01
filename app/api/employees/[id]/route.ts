import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRequest } from '@/lib/verify-admin'
import { callerSharesCompanyWith } from '@/lib/company-access'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const verified = await verifyAdminRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  const { id } = await params

  if (id === verified.user.id) {
    return NextResponse.json({ error: 'Du kan ikke slette din egen konto.' }, { status: 400 })
  }

  if (!(await callerSharesCompanyWith(verified.user.id, id))) {
    return NextResponse.json({ error: 'Du har ikke tilgang til denne ansatte.' }, { status: 403 })
  }

  const { data: target } = await supabaseAdmin.from('profiles').select('full_name, email').eq('id', id).single()

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await supabaseAdmin.from('audit_log').insert({
    actor_id: verified.user.id,
    action: 'employee_deleted',
    target_profile_id: null,
    details: { target_name: target?.full_name ?? target?.email ?? id },
  })

  return NextResponse.json({ ok: true })
}
