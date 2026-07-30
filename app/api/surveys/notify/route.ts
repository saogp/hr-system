import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminOrManagerRequest } from '@/lib/verify-admin'
import { renderEmailHtml } from '@/lib/email-template'

export async function POST(request: Request) {
  const verified = await verifyAdminOrManagerRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { surveyId, title, recipientIds } = await request.json()
  if (!surveyId || !Array.isArray(recipientIds) || recipientIds.length === 0) {
    return NextResponse.json({ error: 'Mangler undersøkelse-id eller mottakere.' }, { status: 400 })
  }

  const { data: recipients } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email')
    .in('id', recipientIds)

  const recipientList = (recipients ?? []).filter((r) => r.email)
  if (recipientList.length === 0) {
    return NextResponse.json({ ok: true, sentCount: 0 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
  const surveyUrl = `${siteUrl}/surveys/${surveyId}`

  const results = await Promise.allSettled(
    recipientList.map((r) => {
      const firstName = (r.full_name || '').split(' ')[0] || 'der'
      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to: r.email,
          subject: `Ny undersøkelse: ${title}`,
          text: `Hei ${firstName}\n\nDu har mottatt en ny undersøkelse: "${title}".\n\nSvar her: ${surveyUrl}`,
          html: renderEmailHtml({
            heading: 'Ny undersøkelse',
            bodyHtml: `<p>Hei ${firstName}</p><p>Du har mottatt en ny undersøkelse: <strong>${title}</strong>.</p>`,
            ctaLabel: 'Svar på undersøkelsen',
            ctaUrl: surveyUrl,
          }),
        }),
      })
    })
  )

  const sentCount = results.filter((r) => r.status === 'fulfilled').length
  return NextResponse.json({ ok: true, sentCount })
}
