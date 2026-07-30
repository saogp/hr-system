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
    return NextResponse.json({ error: 'E-post er ikke konfigurert (mangler RESEND_API_KEY).' }, { status: 501 })
  }

  const { contractId } = await request.json()
  if (!contractId) {
    return NextResponse.json({ error: 'Mangler kontrakt-id.' }, { status: 400 })
  }

  const { data: contract } = await supabaseAdmin
    .from('contracts')
    .select('id, profile_id, contract_templates!contracts_template_id_fkey(name), profiles!contracts_profile_id_fkey(full_name, email)')
    .eq('id', contractId)
    .single()

  if (!contract) {
    return NextResponse.json({ error: 'Fant ikke kontrakten.' }, { status: 404 })
  }

  const employee = (contract as unknown as { profiles: { full_name: string | null; email: string | null } | null }).profiles
  const templateName = (contract as unknown as { contract_templates: { name: string } | null }).contract_templates?.name || 'Kontrakt'

  if (!employee?.email) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const firstName = (employee.full_name || '').split(' ')[0] || 'der'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
  const contractUrl = `${siteUrl}/contracts/${contractId}`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        to: employee.email,
        subject: 'Du har mottatt en kontrakt til signering',
        text: `Hei ${firstName}\n\nDu har mottatt "${templateName}" til signering.\n\nSigner her: ${contractUrl}`,
        html: renderEmailHtml({
          heading: 'Du har mottatt en kontrakt til signering',
          bodyHtml: `<p>Hei ${firstName}</p><p>Du har mottatt <strong>${templateName}</strong> til signering.</p>`,
          ctaLabel: 'Se og signer kontrakten',
          ctaUrl: contractUrl,
        }),
      }),
    })
  } catch {
    // E-post er best-effort — skal ikke blokkere selve utsendelsen av kontrakten.
  }

  return NextResponse.json({ ok: true })
}
