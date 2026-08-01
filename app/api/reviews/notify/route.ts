import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminOrManagerRequest } from '@/lib/verify-admin'
import { renderEmailHtml, getEmailFrom, getPlainTextFooter } from '@/lib/email-template'
import { callerSharesCompanyWith } from '@/lib/company-access'

export async function POST(request: Request) {
  const verified = await verifyAdminOrManagerRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { reviewId, employeeId, leaderId, dateLabel } = await request.json()
  if (!reviewId || !employeeId) {
    return NextResponse.json({ error: 'Mangler samtale-id eller ansatt.' }, { status: 400 })
  }

  if (!(await callerSharesCompanyWith(verified.user.id, employeeId))) {
    return NextResponse.json({ error: 'Du har ikke tilgang til denne ansatte.' }, { status: 403 })
  }

  const recipientIds = [employeeId, leaderId].filter(Boolean) as string[]
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
  const reviewUrl = `${siteUrl}/reviews/${reviewId}`

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
          subject: 'Medarbeidersamtale planlagt',
          text: `Hei ${firstName},\n\nDu har fått en medarbeidersamtale ${dateLabel}.\n\nSe detaljer her: ${reviewUrl}\n\n${getPlainTextFooter(employerName)}`,
          html: renderEmailHtml({
            heading: 'Medarbeidersamtale planlagt',
            bodyHtml: `<p>Hei ${firstName},</p><p>Du har fått en medarbeidersamtale <strong>${dateLabel}</strong>.</p>`,
            ctaLabel: 'Se detaljer',
            ctaUrl: reviewUrl,
            employerName,
          }),
        }),
      })
    })
  )

  const sentCount = results.filter((r) => r.status === 'fulfilled').length
  return NextResponse.json({ ok: true, sentCount })
}
