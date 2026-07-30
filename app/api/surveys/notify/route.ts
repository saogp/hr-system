import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminOrManagerRequest } from '@/lib/verify-admin'
import { renderEmailHtml, getEmailFrom, getPlainTextFooter } from '@/lib/email-template'

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

  const { data: pcData } = await supabaseAdmin
    .from('profile_companies')
    .select('profile_id, companies(name)')
    .in('profile_id', recipientList.map((r) => r.id))
  const employerByProfile = new Map<string, string>()
  for (const row of (pcData ?? []) as unknown as { profile_id: string; companies: { name: string } | null }[]) {
    if (!employerByProfile.has(row.profile_id) && row.companies?.name) {
      employerByProfile.set(row.profile_id, row.companies.name)
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
  const surveyUrl = `${siteUrl}/surveys/${surveyId}`

  const results = await Promise.allSettled(
    recipientList.map((r) => {
      const firstName = (r.full_name || '').split(' ')[0] || 'der'
      const employerName = employerByProfile.get(r.id)
      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: getEmailFrom(),
          to: r.email,
          subject: `Ny undersøkelse: ${title}`,
          text: `Hei ${firstName},\n\nDu har mottatt en ny undersøkelse: "${title}".\n\nSvar her: ${surveyUrl}\n\n${getPlainTextFooter(employerName)}`,
          html: renderEmailHtml({
            heading: 'Ny undersøkelse',
            bodyHtml: `<p>Hei ${firstName},</p><p>Du har mottatt en ny undersøkelse: <strong>${title}</strong>.</p>`,
            ctaLabel: 'Svar på undersøkelsen',
            ctaUrl: surveyUrl,
            employerName,
          }),
        }),
      })
    })
  )

  const sentCount = results.filter((r) => r.status === 'fulfilled').length
  return NextResponse.json({ ok: true, sentCount })
}
