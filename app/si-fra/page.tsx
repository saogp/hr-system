'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push-client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

type PersonOption = { id: string; full_name: string | null; email: string | null }
type ReceivedMessage = { id: string; message: string; read: boolean; created_at: string }

export default function SiFraPage() {
  const router = useRouter()
  const [people, setPeople] = useState<PersonOption[]>([])
  const [recipientId, setRecipientId] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [inbox, setInbox] = useState<ReceivedMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: ownProfile } = await supabase
        .from('profiles')
        .select('manager_id')
        .eq('id', user.id)
        .single()

      const { data: peopleData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .neq('id', user.id)
        .order('full_name')
      if (peopleData) setPeople(peopleData)

      if (ownProfile?.manager_id) {
        setRecipientId(ownProfile.manager_id)
      }

      const { data: inboxData } = await supabase
        .from('concern_reports')
        .select('id, message, read, created_at')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
      if (inboxData) setInbox(inboxData)

      setLoading(false)
    }

    load()
  }, [router])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)

    const { error } = await supabase
      .from('concern_reports')
      .insert({ recipient_id: recipientId, message })

    if (!error) {
      setMessage('')
      setSent(true)
      sendPushNotification(recipientId, 'Ny melding i Si fra', 'Du har mottatt en anonym melding.', '/si-fra')
    }
    setSending(false)
  }

  const handleMarkRead = async (id: string) => {
    const { error } = await supabase.from('concern_reports').update({ read: true }).eq('id', id)
    if (!error) {
      setInbox(prev => prev.map(m => (m.id === id ? { ...m, read: true } : m)))
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) {
    return <div className="p-8">Laster...</div>
  }

  return (
    <div className="container mx-auto py-10 px-4 max-w-lg space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Si fra</h1>
        <p className="text-muted-foreground text-sm">
          Opplever du noe ubehagelig på jobb? Send en anonym melding til en leder. Meldingen lagres
          uten avsenderinformasjon — ingen, heller ikke admin, kan se hvem som sendte den.
        </p>
      </div>

      <form onSubmit={handleSend} className="flex flex-col gap-4">
        {sent && (
          <Alert>
            <AlertDescription>Meldingen er sendt anonymt.</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label>Send til</Label>
          <Select value={recipientId} onValueChange={(val) => val && setRecipientId(val)}>
            <SelectTrigger className="w-full h-8">
              <SelectValue placeholder="Velg mottaker" />
            </SelectTrigger>
            <SelectContent>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="message">Melding</Label>
          <Textarea
            id="message"
            className="min-h-32"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Skriv det du vil si fra om..."
            required
          />
        </div>

        <Button type="submit" disabled={sending || !recipientId || !message.trim()}>
          {sending ? 'Sender...' : 'Send anonymt'}
        </Button>
      </form>

      {inbox.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Mottatte meldinger</h2>
          <div className="flex flex-col divide-y divide-border rounded-md border border-input">
            {inbox.map((m) => (
              <div key={m.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{formatDate(m.created_at)}</p>
                  {m.read ? (
                    <Badge variant="secondary">Lest</Badge>
                  ) : (
                    <Badge className="bg-blue-600 hover:bg-blue-700">Ny</Badge>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                {!m.read && (
                  <Button size="sm" variant="outline" onClick={() => handleMarkRead(m.id)}>
                    Merk som lest
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
