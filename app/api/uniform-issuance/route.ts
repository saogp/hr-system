import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminOrManagerRequest } from '@/lib/verify-admin'
import { needsCardCredentials } from '@/lib/uniform-items'
import { renderEmailHtml, getEmailFrom, getPlainTextFooter } from '@/lib/email-template'

export async function POST(request: Request) {
  const verified = await verifyAdminOrManagerRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  const { profileId, items, sendEmail } = await request.json()

  if (!profileId || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Velg ansatt og minst ett utstyr.' }, { status: 400 })
  }

  const preparedItems = items.map((item: { type: string; size: string; quantity: number; cardNumber?: string; cardPassword?: string }) => ({
    id: crypto.randomUUID(),
    type: item.type,
    size: item.size,
    quantity: item.quantity,
    card_number: item.cardNumber || null,
    card_password: item.cardPassword || null,
    returned: false,
    returned_at: null,
  }))

  const { data: employee } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email')
    .eq('id', profileId)
    .single()

  if (!employee) {
    return NextResponse.json({ error: 'Fant ikke ansatt.' }, { status: 404 })
  }

  const { data: issuance, error } = await supabaseAdmin
    .from('uniform_issuances')
    .insert({
      profile_id: profileId,
      created_by: verified.user.id,
      items: preparedItems,
      send_email: Boolean(sendEmail),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (sendEmail && process.env.RESEND_API_KEY && employee.email) {
    const itemList = preparedItems
      .map((i: { type: string; size: string; quantity: number; card_number: string | null }) =>
        needsCardCredentials(i.type)
          ? `- ${i.type}${i.card_number ? ` (nr. ${i.card_number})` : ''}`
          : `- ${i.type}${i.size !== 'Ingen' ? ` (${i.size})` : ''}${i.quantity > 1 ? ` x${i.quantity}` : ''}`
      )
      .join('\n')
    const firstName = (employee.full_name || '').split(' ')[0] || 'der'
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
    const confirmUrl = `${siteUrl}/uniformer/${issuance.id}`

    const { data: pcRow } = await supabaseAdmin
      .from('profile_companies')
      .select('companies(name)')
      .eq('profile_id', profileId)
      .limit(1)
      .maybeSingle()
    const employerName = (pcRow as unknown as { companies: { name: string } | null } | null)?.companies?.name

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: getEmailFrom(),
          to: employee.email,
          subject: 'Du har mottatt personalutstyr',
          text: `Hei ${firstName},\n\nDu har fått utlevert:\n${itemList}\n\nBekreft mottak og signer her: ${confirmUrl}\n\n${getPlainTextFooter(employerName)}`,
          html: renderEmailHtml({
            heading: 'Du har mottatt personalutstyr',
            bodyHtml: `<p>Hei ${firstName},</p><p>Du har fått utlevert:</p><ul>${preparedItems.map((i: { type: string; size: string; quantity: number; card_number: string | null }) => `<li>${needsCardCredentials(i.type) ? `${i.type}${i.card_number ? ` (nr. ${i.card_number})` : ''}` : `${i.type}${i.size !== 'Ingen' ? ` (${i.size})` : ''}${i.quantity > 1 ? ` x${i.quantity}` : ''}`}</li>`).join('')}</ul>`,
            ctaLabel: 'Bekreft mottak og signer',
            ctaUrl: confirmUrl,
            employerName,
          }),
        }),
      })
    } catch {
      // E-post er best-effort — skal ikke blokkere selve registreringen.
    }
  }

  return NextResponse.json({ ok: true, issuance })
}
