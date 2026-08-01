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
    return NextResponse.json(
      { error: 'E-post er ikke satt opp ennå. Legg til RESEND_API_KEY i miljøvariablene for å aktivere fellesmail.' },
      { status: 501 }
    )
  }

  const formData = await request.formData()
  const subject = String(formData.get('subject') ?? '').trim()
  const message = String(formData.get('message') ?? '').trim()
  const pdf = formData.get('pdf') as File | null
  const recipientIds = JSON.parse(String(formData.get('recipientIds') ?? '[]')) as string[]
  const titles = JSON.parse(String(formData.get('titles') ?? '[]')) as string[]

  if (!subject || !message) {
    return NextResponse.json({ error: 'Emne og melding er påkrevd.' }, { status: 400 })
  }

  const { data: senderProfile } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', verified.user.id)
    .single()

  const { data: recipients } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, title')
    .neq('id', verified.user.id)

  let recipientList = (recipients ?? []).filter((r) => r.email)

  if (recipientIds.length > 0) {
    recipientList = recipientList.filter((r) => recipientIds.includes(r.id))
  } else if (titles.length > 0) {
    recipientList = recipientList.filter((r) => {
      const personTitles = (r.title || '').split(',').map((t: string) => t.trim())
      return titles.some((t) => personTitles.includes(t))
    })
  }

  if (recipientList.length === 0) {
    return NextResponse.json({ error: 'Fant ingen mottakere.' }, { status: 400 })
  }

  const { data: pcData } = await supabaseAdmin
    .from('profile_companies')
    .select('profile_id, companies(name)')
    .in('profile_id', recipientList.map((r) => r.id))
  const employerByProfile = new Map<string, string>()
  for (const row of (pcData ?? []) as unknown as { profile_id: string; companies: { name: string } | null }[]) {
    if (!employerByProfile.has(row.profile_id) && row.companies?.name) {
      employerByProfile.set(row.profile_id, row.companies.name)
    }
  }

  let pdfUrl: string | null = null
  let pdfFilename: string | null = null

  if (pdf && pdf.size > 0) {
    const bytes = new Uint8Array(await pdf.arrayBuffer())
    const path = `${Date.now()}-${pdf.name}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('broadcast-attachments')
      .upload(path, bytes, { contentType: pdf.type || 'application/pdf' })

    if (!uploadError) {
      const { data: publicUrlData } = supabaseAdmin.storage.from('broadcast-attachments').getPublicUrl(path)
      pdfUrl = publicUrlData.publicUrl
      pdfFilename = pdf.name
    }
  }

  const senderName = senderProfile?.full_name || 'HR'
  const attachments = pdf && pdf.size > 0
    ? [{
        filename: pdf.name,
        content: Buffer.from(await pdf.arrayBuffer()).toString('base64'),
      }]
    : undefined

  const results = await Promise.allSettled(
    recipientList.map((r) => {
      const firstName = (r.full_name || '').split(' ')[0] || 'der'
      const employerName = employerByProfile.get(r.id)
      const body = `Hei ${firstName},\n\n${message}\n\nHilsen ${senderName}\n\n${getPlainTextFooter(employerName)}`
      const html = renderEmailHtml({
        heading: subject,
        bodyHtml: `<p>Hei ${firstName},</p><p style="white-space: pre-wrap;">${message}</p><p>Hilsen ${senderName}</p>`,
        employerName,
      })
      return fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: getEmailFrom(),
          to: r.email,
          subject,
          text: body,
          html,
          attachments,
        }),
      })
    })
  )

  const sentCount = results.filter((r) => r.status === 'fulfilled').length

  await supabaseAdmin.from('broadcast_messages').insert({
    sender_id: verified.user.id,
    subject,
    message,
    recipient_count: sentCount,
    pdf_url: pdfUrl,
    pdf_filename: pdfFilename,
  })

  return NextResponse.json({ ok: true, sentCount })
}
