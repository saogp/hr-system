import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: group, error: groupError } = await supabaseAdmin
    .from('cleaning_room_groups')
    .select('id, name, questions')
    .eq('id', id)
    .single()

  if (groupError || !group) {
    return NextResponse.json({ error: 'Fant ikke gruppen.' }, { status: 404 })
  }

  const { data: rooms } = await supabaseAdmin
    .from('cleaning_rooms')
    .select('id, name')
    .eq('group_id', id)
    .order('sort_order')

  return NextResponse.json({
    group,
    rooms: rooms ?? [],
  })
}
