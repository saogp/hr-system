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
    return NextResponse.json({ error: 'E-post er ikke konfigurert (mangler RESEND_API_KEY).' }, { status: 501 })
  }

  const { contractId } = await request.json()
  if (!contractId) {
    return NextResponse.json({ error: 'Mangler kontrakt-id.' }, { status: 400 })
  }

  const { data: contract } = await supabaseAdmin
    .from('contracts')
    .select('id, profile_id, company_id, contract_templates!contracts_template_id_fkey(name), profiles!contracts_profile_id_fkey(full_name, email), companies(name)')
    .eq('id', contractId)
    .single()

  if (!contract) {
    return NextResponse.json({ error: 'Fant ikke kontrakten.' }, { status: 404 })
  }

  const employee = (contract as unknown as { profiles: { full_name: string | null; email: string | null } | null }).profiles
  const templateName = (contract as unknown as { contract_templates: { name: string } | null }).contract_templates?.name || 'Kontrakt'
  const employerName = (contract as unknown as { companies: { name: string } | null }).companies?.name

  if (!employee?.email) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const firstName = (employee.full_name || '').split(' ')[0] || 'der'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
  const contractUrl = `${siteUrl}/contracts/${contractId}`

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getEmailFrom(),
        to: employee.email,
        subject: 'Du har mottatt en kontrakt til signering',
        text: `Hei ${firstName},\n\nDu har mottatt "${templateName}" til signering.\n\nSigner her: ${contractUrl}\n\n${getPlainTextFooter(employerName)}`,
        html: renderEmailHtml({
          heading: 'Du har mottatt en kontrakt til signering',
          bodyHtml: `<p>Hei ${firstName},</p><p>Du har mottatt <strong>${templateName}</strong> til signering.</p>`,
          ctaLabel: 'Se og signer kontrakten',
          ctaUrl: contractUrl,
          employerName,
        }),
      }),
    })

    if (!resendRes.ok) {
      const result = await resendRes.json().catch(() => ({}))
      return NextResponse.json({ error: result.message || 'Resend avviste e-posten.' }, { status: 502 })
    }
  } catch {
    return NextResponse.json({ error: 'Kunne ikke nå e-posttjenesten.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
