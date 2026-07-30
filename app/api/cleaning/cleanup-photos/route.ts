import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminOrManagerRequest } from '@/lib/verify-admin'

async function isAuthorized(request: Request): Promise<boolean> {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true
  }
  const verified = await verifyAdminOrManagerRequest(request)
  return !('error' in verified)
}

export async function GET(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Ikke autorisert.' }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)

  const { data: oldChecks } = await supabaseAdmin
    .from('cleaning_checks')
    .select('id, deviation_photos')
    .lt('checked_at', cutoff.toISOString())
    .neq('deviation_photos', '[]')

  let deletedCount = 0

  for (const check of oldChecks ?? []) {
    const paths = (check.deviation_photos as string[]) ?? []
    if (paths.length === 0) continue

    await supabaseAdmin.storage.from('cleaning-photos').remove(paths)
    await supabaseAdmin.from('cleaning_checks').update({ deviation_photos: [] }).eq('id', check.id)
    deletedCount += paths.length
  }

  return NextResponse.json({ ok: true, checksProcessed: oldChecks?.length ?? 0, photosDeleted: deletedCount })
}
