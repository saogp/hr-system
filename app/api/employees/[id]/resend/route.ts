import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminOrManagerRequest } from '@/lib/verify-admin'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const verified = await verifyAdminOrManagerRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  const { id } = await params

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name')
    .eq('id', id)
    .single()

  if (!profile?.email) {
    return NextResponse.json({ error: 'Fant ingen e-post for denne ansatte.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(profile.email, {
    data: profile.full_name ? { full_name: profile.full_name } : undefined,
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')}/onboarding`,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
