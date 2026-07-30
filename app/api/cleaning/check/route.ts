import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const formData = await request.formData()
  const roomId = String(formData.get('roomId') ?? '')
  const checkedByName = String(formData.get('checkedByName') ?? '').trim() || null
  const deviationNote = String(formData.get('deviationNote') ?? '').trim() || null
  const checklistRaw = String(formData.get('checklist') ?? '[]')
  const photos = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0).slice(0, 3)

  if (!roomId) {
    return NextResponse.json({ error: 'Mangler rom.' }, { status: 400 })
  }

  let checklist: { question: string; checked: boolean }[] = []
  try {
    checklist = JSON.parse(checklistRaw)
  } catch {
    checklist = []
  }

  const photoPaths: string[] = []
  for (let i = 0; i < photos.length; i++) {
    const file = photos[i]
    const bytes = new Uint8Array(await file.arrayBuffer())
    const path = `${roomId}/${Date.now()}-${i}-${file.name}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('cleaning-photos')
      .upload(path, bytes, { contentType: file.type || 'image/jpeg' })
    if (!uploadError) photoPaths.push(path)
  }

  const { error } = await supabaseAdmin.from('cleaning_checks').insert({
    room_id: roomId,
    checked_by_name: checkedByName,
    checklist,
    deviation_note: deviationNote,
    deviation_photos: photoPaths,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
