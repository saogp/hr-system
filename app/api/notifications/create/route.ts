import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { NOTIFICATION_TYPES, type NotificationType, type NotificationPrefs } from '@/lib/notifications'
import { renderEmailHtml, getEmailFrom, getPlainTextFooter } from '@/lib/email-template'

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

  const { recipientId, recipientRole, type, title, body, link } = await request.json()
  if ((!recipientId && !recipientRole) || !type || !title || !(type in NOTIFICATION_TYPES)) {
    return NextResponse.json({ error: 'Mangler eller ugyldige felt.' }, { status: 400 })
  }

  let recipientIds: string[] = []
  if (recipientRole) {
    const { data: roleProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', recipientRole)
      .neq('id', user.id)
    recipientIds = (roleProfiles ?? []).map((p) => p.id)
  } else {
    recipientIds = [recipientId]
  }

  if (recipientIds.length === 0) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { data: recipients } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, notification_prefs')
    .in('id', recipientIds)

  const eligible = (recipients ?? []).map((r) => {
    const prefs = (r.notification_prefs as NotificationPrefs | null)?.[type as NotificationType]
    return {
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      pushEnabled: prefs?.push !== false,
      emailEnabled: prefs?.email !== false,
    }
  })

  const bellRows = eligible
    .filter((r) => r.pushEnabled)
    .map((r) => ({
      recipient_id: r.id,
      type,
      title,
      body: body || null,
      link: link || null,
    }))

  if (bellRows.length > 0) {
    await supabaseAdmin.from('notifications').insert(bellRows)
  }

  const emailRecipients = eligible.filter((r) => r.emailEnabled && r.email)
  if (emailRecipients.length > 0 && process.env.RESEND_API_KEY) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
    const fullLink = link ? `${siteUrl}${link}` : undefined

    await Promise.allSettled(
      emailRecipients.map((r) => {
        const firstName = (r.full_name || '').split(' ')[0] || 'der'
        return fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: getEmailFrom(),
            to: r.email,
            subject: title,
            text: `Hei ${firstName},\n\n${body || title}${fullLink ? `\n\nSe her: ${fullLink}` : ''}\n\n${getPlainTextFooter()}`,
            html: renderEmailHtml({
              heading: title,
              bodyHtml: `<p>Hei ${firstName},</p><p>${body || title}</p>`,
              ctaLabel: fullLink ? 'Åpne' : undefined,
              ctaUrl: fullLink,
            }),
          }),
        })
      })
    )
  }

  return NextResponse.json({ ok: true, bellCount: bellRows.length, emailCount: emailRecipients.length })
}
