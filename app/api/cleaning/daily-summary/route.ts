import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminOrManagerRequest } from '@/lib/verify-admin'
import { deliverNotification } from '@/app/api/notifications/create/route'

export async function POST(request: Request) {
  const verified = await verifyAdminOrManagerRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data: rooms } = await supabaseAdmin.from('cleaning_rooms').select('id, name').order('sort_order')
  const { data: checks } = await supabaseAdmin.from('cleaning_checks').select('room_id').eq('check_date', today)

  if (!rooms || rooms.length === 0) {
    return NextResponse.json({ message: 'Ingen rom registrert.' })
  }

  const checkedRoomIds = new Set((checks ?? []).map((c) => c.room_id))
  const missingRooms = rooms.filter((r) => !checkedRoomIds.has(r.id))

  const dateLabel = new Date().toLocaleDateString('no-NO', { day: 'numeric', month: 'long', year: 'numeric' })
  const title = `Renhold – status ${dateLabel}`
  const body = missingRooms.length === 0
    ? `Alle rom er rengjort i dag (${dateLabel}).`
    : `Følgende rom er IKKE registrert som rengjort i dag (${dateLabel}): ${missingRooms.map((r) => r.name).join(', ')}`

  const { data: recipients } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'manager'])

  const result = await deliverNotification({
    recipientIds: (recipients ?? []).map((r) => r.id),
    type: 'cleaning_daily_summary',
    title,
    body,
    link: '/renhold',
  })

  if (result.skipped) {
    return NextResponse.json({ error: 'Ingen mottakere har slått på dette varselet.' }, { status: 400 })
  }

  return NextResponse.json({ message: `Sendt til ${result.bellCount} i bjelle, ${result.emailCount} på e-post.` })
}
