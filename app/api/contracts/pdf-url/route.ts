import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { callerSharesCompanyWith } from '@/lib/company-access'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Ikke innlogget.' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Ikke innlogget.' }, { status: 401 })
  }

  const { contractId } = await request.json()
  if (!contractId) {
    return NextResponse.json({ error: 'Mangler kontrakt-id.' }, { status: 400 })
  }

  const { data: contract } = await supabaseAdmin
    .from('contracts')
    .select('profile_id, pdf_path')
    .eq('id', contractId)
    .single()

  if (!contract?.pdf_path) {
    return NextResponse.json({ error: 'Fant ikke PDF-en.' }, { status: 404 })
  }

  const { data: caller } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdminOrManager = caller?.role === 'admin' || caller?.role === 'manager'
  const isOwner = contract.profile_id === user.id
  const hasCompanyAccess = isAdminOrManager && (await callerSharesCompanyWith(user.id, contract.profile_id))
  if (!hasCompanyAccess && !isOwner) {
    return NextResponse.json({ error: 'Du har ikke tilgang til dette.' }, { status: 403 })
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from('contract-pdfs')
    .createSignedUrl(contract.pdf_path, 60 * 10)

  if (signError || !signed) {
    return NextResponse.json({ error: 'Kunne ikke hente PDF-en.' }, { status: 500 })
  }

  return NextResponse.json({ url: signed.signedUrl })
}
