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
    .select('id, company_id, contract_templates!contracts_template_id_fkey(name), profiles!contracts_profile_id_fkey(full_name, email)')
    .eq('id', contractId)
    .single()

  if (!contract) {
    return NextResponse.json({ error: 'Fant ikke kontrakten.' }, { status: 404 })
  }

  const companyId = (contract as unknown as { company_id: string | null }).company_id
  if (!companyId) {
    return NextResponse.json({ error: 'Kontrakten er ikke koblet til en bedrift.' }, { status: 400 })
  }

  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('name, accountant_email')
    .eq('id', companyId)
    .single()

  if (!company?.accountant_email) {
    return NextResponse.json(
      { error: 'Sett e-post for regnskapsfører på bedriften først (Innstillinger → Bedrifter).' },
      { status: 400 }
    )
  }

  const employee = (contract as unknown as { profiles: { full_name: string | null; email: string | null } | null }).profiles
  const templateName = (contract as unknown as { contract_templates: { name: string } | null }).contract_templates?.name || 'Kontrakt'
  const employeeName = employee?.full_name || employee?.email || 'ukjent ansatt'

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
  const contractUrl = `${siteUrl}/contracts/${contractId}`
  const footerContext = `Denne e-posten ble sendt fra ZEST fordi ${company.name} har registrert deg som regnskapsfører i systemet.`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getEmailFrom(),
        to: company.accountant_email,
        subject: `Kontrakt til regnskap – ${employeeName}`,
        text: `Hei,\n\nEn kontrakt for ${employeeName} (${templateName}) hos ${company.name} er klar for regnskap.\n\nSe kontrakten her: ${contractUrl}\n\n${getPlainTextFooter(undefined, footerContext)}`,
        html: renderEmailHtml({
          heading: 'Kontrakt til regnskap',
          bodyHtml: `<p>En kontrakt for <strong>${employeeName}</strong> (${templateName}) hos ${company.name} er klar for regnskap.</p>`,
          ctaLabel: 'Se kontrakten',
          ctaUrl: contractUrl,
          footerContext,
        }),
      }),
    })
  } catch {
    return NextResponse.json({ error: 'Kunne ikke sende e-post til regnskapsfører.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
