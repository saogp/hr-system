import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase-admin'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Ikke innlogget.' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Ikke innlogget.' }, { status: 401 })
  }

  const { profileId, title, body, url } = await request.json()
  if (!profileId || !title) {
    return NextResponse.json({ error: 'profileId og title er påkrevd.' }, { status: 400 })
  }

  const { data: subscriptions } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('profile_id', profileId)

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const payload = JSON.stringify({ title, body, url })

  let sent = 0
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      )
      sent += 1
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  return NextResponse.json({ sent })
}
