import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminOrManagerRequest } from '@/lib/verify-admin'

export async function POST(request: Request) {
  const verified = await verifyAdminOrManagerRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  const formData = await request.formData()
  const profileId = String(formData.get('profileId') ?? '')
  const companyId = String(formData.get('companyId') ?? '') || null
  const signedDate = String(formData.get('signedDate') ?? '')
  const pdf = formData.get('pdf') as File | null

  if (!profileId || !pdf || pdf.size === 0) {
    return NextResponse.json({ error: 'Velg ansatt og en PDF-fil.' }, { status: 400 })
  }
  if (pdf.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Filen må være en PDF.' }, { status: 400 })
  }

  const { data: employee } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .single()

  if (!employee) {
    return NextResponse.json({ error: 'Fant ikke ansatt.' }, { status: 404 })
  }

  const path = `${profileId}/${Date.now()}-${pdf.name}`
  const bytes = new Uint8Array(await pdf.arrayBuffer())
  const { error: uploadError } = await supabaseAdmin.storage
    .from('contract-pdfs')
    .upload(path, bytes, { contentType: 'application/pdf' })

  if (uploadError) {
    return NextResponse.json({ error: 'Kunne ikke laste opp PDF-en.' }, { status: 500 })
  }

  const sentAt = signedDate ? new Date(signedDate).toISOString() : new Date().toISOString()

  const { data: contract, error: insertError } = await supabaseAdmin
    .from('contracts')
    .insert({
      template_id: null,
      profile_id: profileId,
      company_id: companyId,
      admin_fields: {},
      sent_at: sentAt,
      pdf_path: path,
      created_by: verified.user.id,
    })
    .select()
    .single()

  if (insertError) {
    await supabaseAdmin.storage.from('contract-pdfs').remove([path])
    return NextResponse.json({ error: 'Kunne ikke lagre kontrakten.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, contract })
}
