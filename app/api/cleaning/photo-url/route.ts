import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminOrManagerRequest } from '@/lib/verify-admin'

export async function POST(request: Request) {
  const verified = await verifyAdminOrManagerRequest(request)
  if ('error' in verified) {
    return NextResponse.json({ error: verified.error }, { status: verified.status })
  }

  const { paths } = await request.json()
  if (!Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ urls: {} })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('cleaning-photos')
    .createSignedUrls(paths, 60 * 10)

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Kunne ikke hente bilder.' }, { status: 400 })
  }

  const urls: Record<string, string> = {}
  for (const item of data) {
    if (item.signedUrl && item.path) urls[item.path] = item.signedUrl
  }

  return NextResponse.json({ urls })
}
