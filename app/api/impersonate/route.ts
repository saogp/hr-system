import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRequest } from '@/lib/verify-admin'
import { callerSharesCompanyWith } from '@/lib/company-access'

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  const { targetUserId } = await request.json()
  if (!targetUserId) {
    return NextResponse.json({ error: 'Mangler bruker.' }, { status: 400 })
  }

  if (!(await callerSharesCompanyWith(verified.user.id, targetUserId))) {
    return NextResponse.json({ error: 'Du har ikke tilgang til denne brukeren.' }, { status: 403 })
  }

  const { data: targetUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
  if (userError || !targetUser?.user?.email) {
    return NextResponse.json({ error: 'Fant ikke brukeren.' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetUser.user.email,
  })

  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json({ error: error?.message || 'Kunne ikke bytte bruker.' }, { status: 400 })
  }

  return NextResponse.json({ tokenHash: data.properties.hashed_token })
}
