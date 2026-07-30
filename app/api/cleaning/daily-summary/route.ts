import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminOrManagerRequest } from '@/lib/verify-admin'
import { renderEmailHtml, getEmailFrom, getPlainTextFooter } from '@/lib/email-template'

export async function POST(request: Request) {
  const verified = await verifyAdminOrManagerRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data: rooms } = await supabaseAdmin.from('cleaning_rooms').select('id, name').order('sort_order')
  const { data: checks } = await supabaseAdmin.from('cleaning_checks').select('room_id').eq('check_date', today)
  const { data: recipients } = await supabaseAdmin.from('cleaning_notification_recipients').select('email')

  if (!rooms || rooms.length === 0) {
    return NextResponse.json({ message: 'Ingen rom registrert.' })
  }
  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ error: 'Ingen mottakere lagt til.' }, { status: 400 })
  }

  const checkedRoomIds = new Set((checks ?? []).map((c) => c.room_id))
  const missingRooms = rooms.filter((r) => !checkedRoomIds.has(r.id))

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'E-post er ikke konfigurert (mangler RESEND_API_KEY).' }, { status: 400 })
  }

  const dateLabel = new Date().toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })
  const footerContext = 'Denne e-posten ble sendt fra ZEST fordi du er registrert som mottaker av renholdsvarsler.'
  const body = missingRooms.length === 0
    ? `Alle rom er rengjort i dag (${dateLabel}).`
    : `Følgende rom er IKKE registrert som rengjort i dag (${dateLabel}):\n\n${missingRooms.map((r) => `- ${r.name}`).join('\n')}`
  const bodyHtml = missingRooms.length === 0
    ? `<p>Alle rom er rengjort i dag (${dateLabel}).</p>`
    : `<p>Følgende rom er <strong>ikke</strong> registrert som rengjort i dag (${dateLabel}):</p><ul>${missingRooms.map((r) => `<li>${r.name}</li>`).join('')}</ul>`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getEmailFrom(),
        to: recipients.map((r) => r.email),
        subject: `Renhold – status ${dateLabel}`,
        text: `${body}\n\n${getPlainTextFooter(undefined, footerContext)}`,
        html: renderEmailHtml({ heading: `Renhold – status ${dateLabel}`, bodyHtml, footerContext }),
      }),
    })
  } catch {
    return NextResponse.json({ error: 'Kunne ikke sende e-post.' }, { status: 500 })
  }

  return NextResponse.json({ message: `Sendt til ${recipients.length} mottakere.` })
}
