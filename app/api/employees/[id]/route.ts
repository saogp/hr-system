import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRequest } from '@/lib/verify-admin'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const verified = await verifyAdminRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  const { id } = await params

  if (id === verified.user.id) {
    return NextResponse.json({ error: 'Du kan ikke slette din egen konto.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
