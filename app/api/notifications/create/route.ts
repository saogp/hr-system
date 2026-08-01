import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { NOTIFICATION_TYPES, type NotificationType, type NotificationPrefs } from '@/lib/notifications'
import { renderEmailHtml, getEmailFrom, getPlainTextFooter } from '@/lib/email-template'

async function sendNotificationEmail(recipient: { full_name: string | null; email: string }, title: string, body?: string, fullLink?: string) {
  const firstName = (recipient.full_name || '').split(' ')[0] || 'der'
  return fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to: recipient.email,
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
}

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
    .select('id, full_name, email, notification_prefs, email_digest_mode')
    .in('id', recipientIds)

  const eligible = (recipients ?? [])
    .map((r) => {
      const prefs = (r.notification_prefs as NotificationPrefs | null)?.[type as NotificationType]
      return {
        id: r.id,
        full_name: r.full_name,
        email: r.email,
        wantsPush: prefs?.push !== false,
        wantsEmail: prefs?.email !== false && !!r.email,
        digestMode: r.email_digest_mode === 'daily' ? 'daily' : 'immediate',
      }
    })
    .filter((r) => r.wantsPush || r.wantsEmail)

  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const rows = eligible.map((r) => ({
    recipient_id: r.id,
    type,
    title,
    body: body || null,
    link: link || null,
    show_in_bell: r.wantsPush,
  }))

  const { data: inserted } = await supabaseAdmin.from('notifications').insert(rows).select('id, recipient_id')
  const rowIdByRecipient = new Map((inserted ?? []).map((row) => [row.recipient_id, row.id]))

  const immediateEmailRecipients = eligible.filter((r) => r.wantsEmail && r.digestMode === 'immediate')
  let emailCount = 0
  if (immediateEmailRecipients.length > 0 && process.env.RESEND_API_KEY) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
    const fullLink = link ? `${siteUrl}${link}` : undefined

    const results = await Promise.allSettled(
      immediateEmailRecipients.map((r) => sendNotificationEmail({ full_name: r.full_name, email: r.email! }, title, body, fullLink))
    )
    emailCount = results.filter((res) => res.status === 'fulfilled').length

    const sentAt = new Date().toISOString()
    const emailedRowIds = immediateEmailRecipients
      .map((r) => rowIdByRecipient.get(r.id))
      .filter((id): id is string => !!id)
    if (emailedRowIds.length > 0) {
      await supabaseAdmin.from('notifications').update({ emailed_at: sentAt }).in('id', emailedRowIds)
    }
  }

  return NextResponse.json({ ok: true, bellCount: rows.filter((r) => r.show_in_bell).length, emailCount })
}
