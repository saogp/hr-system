import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRequest } from '@/lib/verify-admin'

export async function GET(request: Request) {
  const verified = await verifyAdminRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  const statuses: Record<string, {
    invited_at?: string
    confirmed_at?: string
    last_sign_in_at?: string
  }> = {}

  let page = 1
  const perPage = 200
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    for (const u of data.users) {
      statuses[u.id] = {
        invited_at: u.invited_at,
        confirmed_at: u.confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
      }
    }

    if (data.users.length < perPage) break
    page += 1
  }

  return NextResponse.json({ statuses })
}

export async function POST(request: Request) {
  const verified = await verifyAdminRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  const { email, full_name } = await request.json()
  if (!email) {
    return NextResponse.json({ error: 'E-post er påkrevd.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: full_name ? { full_name } : undefined,
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding`,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ user: data.user })
}
