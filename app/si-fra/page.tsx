'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/push-client'
import { sendNotification } from '@/lib/notifications'
import { applyRoleOverride } from '@/lib/role-override'
import { ListPageSkeleton } from '@/components/ui/loading-skeletons'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { IconBadge } from '@/components/ui/icon-badge'
import { ShieldAlert } from 'lucide-react'

type PersonOption = { id: string; full_name: string | null; email: string | null }
type ReceivedMessage = {
  id: string
  message: string
  read: boolean
  created_at: string
  recipient_id: string
  profiles: { full_name: string | null; email: string | null } | null
}

export default function SiFraPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [people, setPeople] = useState<PersonOption[]>([])
  const [recipientId, setRecipientId] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
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
        .select('manager_id, role')
        .eq('id', user.id)
        .single()
      const admin = applyRoleOverride(ownProfile?.role ?? 'employee') === 'admin'
      setIsAdmin(admin)

      const { data: peopleData } = await supabase.rpc('get_people_directory')
      if (peopleData) {
        setPeople(
          (peopleData as PersonOption[])
            .filter((p) => p.id !== user.id)
            .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
        )
      }

      if (ownProfile?.manager_id) {
        setRecipientId(ownProfile.manager_id)
      }

      const baseInboxQuery = supabase
        .from('concern_reports')
        .select('id, message, read, created_at, recipient_id, profiles!concern_reports_recipient_id_fkey(full_name, email)')
        .order('created_at', { ascending: false })
      const { data: inboxData } = admin
        ? await baseInboxQuery
        : await baseInboxQuery.eq('recipient_id', user.id)
      if (inboxData) setInbox(inboxData as unknown as ReceivedMessage[])

      setLoading(false)
    }

    load()
  }, [router])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)

    const { data, error } = await supabase
      .from('concern_reports')
      .insert({ recipient_id: recipientId, message })
      .select('id, message, read, created_at, recipient_id, profiles!concern_reports_recipient_id_fkey(full_name, email)')
      .single()

    if (!error) {
      setMessage('')
      setSent(true)
      sendPushNotification(recipientId, 'Ny melding i Si fra', 'Du har mottatt en anonym melding.', '/si-fra')
      sendNotification({
        recipientId,
        type: 'si_fra_submitted',
        title: 'Ny si fra-melding',
        body: 'Du har mottatt en anonym si fra-melding.',
        link: '/si-fra',
      })
      if (isAdmin && data) {
        setInbox((prev) => [data as unknown as ReceivedMessage, ...prev])
        setSendOpen(false)
      }
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
    return <ListPageSkeleton />
  }

  const sendForm = (
    <form id="si-fra-form" onSubmit={handleSend} className="flex flex-col gap-4">
      {sent && (
        <Alert>
          <AlertDescription>Meldingen er sendt anonymt.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Send til</Label>
        <Select value={recipientId} onValueChange={(val) => val && setRecipientId(val)}>
          <SelectTrigger className="w-full h-9">
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

      {!isAdmin && (
        <Button
          type="submit"
          disabled={sending || !recipientId || !message.trim()}
          className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
        >
          {sending ? 'Sender...' : 'Send anonymt'}
        </Button>
      )}
    </form>
  )

  return (
    <div className={isAdmin ? 'p-6 max-w-[1440px]' : 'p-6 max-w-lg space-y-10'}>
      <div className={isAdmin ? 'mb-6' : ''}>
        <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
          <IconBadge icon={<ShieldAlert className="size-4" />} />
          Si fra
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAdmin
            ? 'Alle anonyme si fra-meldinger som er sendt til ledere. Avsender er alltid skjult.'
            : 'Opplever du noe ubehagelig på jobb? Send en anonym melding til en leder. Meldingen lagres uten avsenderinformasjon — ingen, heller ikke admin, kan se hvem som sendte den.'}
        </p>
      </div>

      {isAdmin ? (
        <>
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => setSendOpen(true)}
              className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
            >
              Si fra
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {inbox.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Ingen si fra-meldinger enda.</p>
            ) : (
              inbox.map((m) => (
                <div key={m.id} className="rounded-xl border border-border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(m.created_at)} · Til {m.profiles?.full_name || m.profiles?.email || '—'}
                    </p>
                    {m.read ? (
                      <Badge variant="secondary">Lest</Badge>
                    ) : (
                      <Badge className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy">Ny</Badge>
                    )}
                  </div>
                  <p className="text-base md:text-sm whitespace-pre-wrap">{m.message}</p>
                  {!m.read && (
                    <Button size="sm" variant="outline" onClick={() => handleMarkRead(m.id)}>
                      Merk som lest
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          <Dialog open={sendOpen} onOpenChange={setSendOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Si fra</DialogTitle>
                <DialogDescription>
                  Send en anonym melding til en leder. Meldingen lagres uten avsenderinformasjon.
                </DialogDescription>
              </DialogHeader>
              {sendForm}
              <DialogFooter>
                <Button
                  type="submit"
                  form="si-fra-form"
                  disabled={sending || !recipientId || !message.trim()}
                  className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
                >
                  {sending ? 'Sender...' : 'Send anonymt'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <>
          {sendForm}

          {inbox.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Mottatte meldinger</h2>
              <div className="flex flex-col divide-y divide-border rounded-xl border border-brand-navy/10">
                {inbox.map((m) => (
                  <div key={m.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">{formatDate(m.created_at)}</p>
                      {m.read ? (
                        <Badge variant="secondary">Lest</Badge>
                      ) : (
                        <Badge className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy">Ny</Badge>
                      )}
                    </div>
                    <p className="text-base md:text-sm whitespace-pre-wrap">{m.message}</p>
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
        </>
      )}
    </div>
  )
}
