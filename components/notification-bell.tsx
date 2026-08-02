'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AllDoneIllustration } from '@/components/decorative/all-done-illustration'

type NotificationRow = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

const POLL_INTERVAL_MS = 60_000

export function NotificationBell() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [canSee, setCanSee] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const allowed = isAdminLike(applyRoleOverride(profile?.role ?? 'employee'))
    setCanSee(allowed)
    if (!allowed) {
      setLoaded(true)
      return
    }

    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, link, read_at, created_at')
      .eq('recipient_id', user.id)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setNotifications(data)
    setLoaded(true)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [load])

  if (pathname === '/login' || pathname === '/onboarding' || pathname.startsWith('/renhold/gruppe')) return null
  if (!loaded || !canSee) return null

  const unreadCount = notifications.length

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  const handleOpenNotification = async (n: NotificationRow) => {
    setNotifications((prev) => prev.filter((x) => x.id !== n.id))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications([])
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative shrink-0">
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 bg-brand-orange text-brand-navy hover:bg-brand-orange">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
            <span className="sr-only">Varsler</span>
          </Button>
        }
      />
      <PopoverContent align="end" collisionAvoidance={{ side: 'flip', align: 'shift' }} className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold">Varsler</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs text-brand-orange font-medium hover:underline"
            >
              Merk alle som lest
            </button>
          )}
        </div>
        <div className="thin-scrollbar h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-6 px-4">
              <AllDoneIllustration className="w-40 h-auto mb-4" />
              <p className="font-medium text-sm">Ingen varsler enda</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleOpenNotification(n)}
                className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left border-b border-border last:border-0 bg-brand-orange/5 hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-brand-orange" />
                  <span className="text-sm font-medium truncate">{n.title}</span>
                </div>
                {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                <span className="text-[11px] text-muted-foreground">{formatDate(n.created_at)}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
