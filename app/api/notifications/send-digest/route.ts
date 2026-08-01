import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { renderEmailHtml, getEmailFrom, getPlainTextFooter } from '@/lib/email-template'
import { NOTIFICATION_TYPES, type NotificationType } from '@/lib/notifications'

// Triggered once daily by Vercel Cron (see vercel.json — Hobby plan allows at
// most one run/day). Sends one combined email per user in daily-digest mode,
// covering every notification queued for them since their last digest.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: 'no RESEND_API_KEY' })
  }

  const { data: dueProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .eq('email_digest_mode', 'daily')

  if (!dueProfiles || dueProfiles.length === 0) {
    return NextResponse.json({ ok: true, sentCount: 0 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
  let sentCount = 0

  for (const profile of dueProfiles) {
    if (!profile.email) continue

    const { data: pending } = await supabaseAdmin
      .from('notifications')
      .select('id, type, title, body, link, created_at')
      .eq('recipient_id', profile.id)
      .is('emailed_at', null)
      .order('created_at', { ascending: true })

    if (!pending || pending.length === 0) continue

    const firstName = (profile.full_name || '').split(' ')[0] || 'der'
    const itemsHtml = pending
      .map((n) => {
        const label = NOTIFICATION_TYPES[n.type as NotificationType] ?? n.title
        const href = n.link ? `${siteUrl}${n.link}` : null
        return `<li style="margin-bottom: 10px;"><strong>${label}</strong>${n.body ? `<br/>${n.body}` : ''}${href ? `<br/><a href="${href}" style="color: #001f3c;">Åpne</a>` : ''}</li>`
      })
      .join('')
    const itemsText = pending
      .map((n) => {
        const label = NOTIFICATION_TYPES[n.type as NotificationType] ?? n.title
        const href = n.link ? `${siteUrl}${n.link}` : null
        return `- ${label}${n.body ? `: ${n.body}` : ''}${href ? ` (${href})` : ''}`
      })
      .join('\n')

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: getEmailFrom(),
          to: profile.email,
          subject: `Daglig oppsummering (${pending.length} varsler)`,
          text: `Hei ${firstName},\n\nHer er dagens varsler:\n\n${itemsText}\n\n${getPlainTextFooter()}`,
          html: renderEmailHtml({
            heading: 'Daglig oppsummering',
            bodyHtml: `<p>Hei ${firstName},</p><p>Her er dagens varsler:</p><ul style="padding-left: 20px;">${itemsHtml}</ul>`,
          }),
        }),
      })

      if (res.ok) {
        sentCount += 1
        await supabaseAdmin
          .from('notifications')
          .update({ emailed_at: new Date().toISOString() })
          .in('id', pending.map((n) => n.id))
      }
    } catch {
      // best-effort — move on to the next recipient
    }
  }

  return NextResponse.json({ ok: true, sentCount })
}
