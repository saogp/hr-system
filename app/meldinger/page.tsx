'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Mail } from 'lucide-react'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { IconBadge } from '@/components/ui/icon-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

type BroadcastMessage = {
  id: string
  subject: string
  message: string
  recipient_count: number
  pdf_url: string | null
  pdf_filename: string | null
  created_at: string
  profiles: { full_name: string | null; email: string | null } | null
}

export default function MeldingerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastPdf, setBroadcastPdf] = useState<File | null>(null)
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastError, setBroadcastError] = useState('')
  const [broadcastSuccess, setBroadcastSuccess] = useState('')
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastMessage[]>([])

  const loadHistory = async () => {
    const { data: broadcastData } = await supabase
      .from('broadcast_messages')
      .select('id, subject, message, recipient_count, pdf_url, pdf_filename, created_at, profiles!broadcast_messages_sender_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
    if (broadcastData) setBroadcastHistory(broadcastData as unknown as BroadcastMessage[])
  }

  useEffect(() => {
    async function checkAccessAndLoad() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!isAdminLike(applyRoleOverride(profile?.role ?? 'employee'))) {
        router.replace('/')
        return
      }

      await loadHistory()
      setLoading(false)
    }

    checkAccessAndLoad()
  }, [router])

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    setSendingBroadcast(true)
    setBroadcastError('')
    setBroadcastSuccess('')

    const { data: { session } } = await supabase.auth.getSession()
    const formData = new FormData()
    formData.append('subject', broadcastSubject)
    formData.append('message', broadcastMessage)
    if (broadcastPdf) formData.append('pdf', broadcastPdf)

    const res = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: formData,
    })

    const result = await res.json().catch(() => ({}))

    if (!res.ok) {
      setBroadcastError(result.error || 'Kunne ikke sende meldingen.')
    } else {
      setBroadcastSuccess(`Sendt til ${result.sentCount} ansatte.`)
      setBroadcastSubject('')
      setBroadcastMessage('')
      setBroadcastPdf(null)
      await loadHistory()
    }

    setSendingBroadcast(false)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) {
    return <div className="p-8">Laster...</div>
  }

  return (
    <div className="max-w-lg py-10 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
          <IconBadge icon={<Mail className="size-4" />} />
          Meldinger
        </h1>
        <p className="text-muted-foreground text-sm">
          Send en e-post til alle ansatte samtidig, med valgfritt PDF-vedlegg.
        </p>
      </div>

      {broadcastError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{broadcastError}</AlertDescription>
        </Alert>
      )}
      {broadcastSuccess && (
        <Alert className="mb-4">
          <AlertDescription>{broadcastSuccess}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSendBroadcast} className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="broadcast-subject">Emne</Label>
          <Input
            id="broadcast-subject"
            value={broadcastSubject}
            onChange={(e) => setBroadcastSubject(e.target.value)}
            placeholder='F.eks. «Innkalling til personalmøte»'
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="broadcast-message">Melding</Label>
          <Textarea
            id="broadcast-message"
            className="min-h-32"
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            placeholder='Skriv meldingen her. «Hei fornavn» og signatur legges til automatisk.'
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="broadcast-pdf">PDF-vedlegg (valgfritt)</Label>
          <Input
            id="broadcast-pdf"
            type="file"
            accept="application/pdf"
            onChange={(e) => setBroadcastPdf(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button
          type="submit"
          disabled={sendingBroadcast || !broadcastSubject.trim() || !broadcastMessage.trim()}
          className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium w-fit"
        >
          {sendingBroadcast ? 'Sender...' : 'Send til alle ansatte'}
        </Button>
      </form>

      <h2 className="text-lg font-semibold mb-2">Historikk</h2>
      {broadcastHistory.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ingen fellesmailer sendt enda.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-md border border-input">
          {broadcastHistory.map((b) => (
            <div key={b.id} className="p-4 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-base md:text-sm font-medium">{b.subject}</p>
                <p className="text-xs text-muted-foreground shrink-0">{formatDate(b.created_at)}</p>
              </div>
              <p className="text-base md:text-sm text-muted-foreground whitespace-pre-wrap">{b.message}</p>
              <p className="text-xs text-muted-foreground">
                Sendt av {b.profiles?.full_name || b.profiles?.email || '—'} til {b.recipient_count} ansatte
                {b.pdf_url && (
                  <>
                    {' · '}
                    <a href={b.pdf_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {b.pdf_filename || 'Vedlegg'}
                    </a>
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
