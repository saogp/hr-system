'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SprayCan, Printer, ChevronDown, ChevronUp, ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { todayIsoDate, type CleaningRoom, type CleaningRoomGroup, type CleaningCheck } from '@/lib/cleaning'
import { printGroupQrCode } from '@/lib/cleaning-qr'

import { IconBadge } from '@/components/ui/icon-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination'

type Company = { id: string; name: string }
type CheckWithRoom = CleaningCheck & { cleaning_rooms: { name: string } | null }

export default function RenholdPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  const [groups, setGroups] = useState<CleaningRoomGroup[]>([])
  const [rooms, setRooms] = useState<CleaningRoom[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [todaysChecks, setTodaysChecks] = useState<CleaningCheck[]>([])
  const [recentChecks, setRecentChecks] = useState<CheckWithRoom[]>([])

  const [historyPage, setHistoryPage] = useState(1)
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})

  const loadGroups = async () => {
    const { data } = await supabase.from('cleaning_room_groups').select('id, name, sort_order, questions, company_id').order('sort_order')
    if (data) setGroups(data)
  }

  const loadRooms = async () => {
    const { data } = await supabase.from('cleaning_rooms').select('id, name, sort_order, group_id').order('sort_order')
    if (data) setRooms(data)
  }

  const loadTodaysChecks = async () => {
    const { data } = await supabase
      .from('cleaning_checks')
      .select('id, room_id, check_date, checked_at, checked_by_name, checklist, deviation_note, deviation_photos')
      .eq('check_date', todayIsoDate())
    if (data) setTodaysChecks(data as unknown as CleaningCheck[])
  }

  const loadRecentChecks = async () => {
    const { data } = await supabase
      .from('cleaning_checks')
      .select('id, room_id, check_date, checked_at, checked_by_name, checklist, deviation_note, deviation_photos, cleaning_rooms(name)')
      .order('checked_at', { ascending: false })
      .limit(200)
    if (data) setRecentChecks(data as unknown as CheckWithRoom[])
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!isAdminLike(applyRoleOverride(profile?.role ?? 'employee'))) {
        router.replace('/')
        return
      }

      const { data: companiesData } = await supabase.from('companies').select('id, name').order('name')
      if (companiesData) setCompanies(companiesData)

      await Promise.all([loadGroups(), loadRooms(), loadTodaysChecks(), loadRecentChecks()])
      setLoading(false)
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const handleChangeGroupCompany = async (groupId: string, companyId: string) => {
    await supabase
      .from('cleaning_room_groups')
      .update({ company_id: companyId === 'none' ? null : companyId })
      .eq('id', groupId)
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, company_id: companyId === 'none' ? null : companyId } : g)))
  }

  const handlePrintGroup = (group: CleaningRoomGroup) => printGroupQrCode(group)

  const handleToggleExpand = async (check: CheckWithRoom) => {
    if (expandedCheckId === check.id) {
      setExpandedCheckId(null)
      return
    }
    setExpandedCheckId(check.id)

    const missingPaths = check.deviation_photos.filter((p) => !photoUrls[p])
    if (missingPaths.length > 0) {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/cleaning/photo-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ paths: missingPaths }),
      })
      const result = await res.json()
      if (res.ok) setPhotoUrls((prev) => ({ ...prev, ...result.urls }))
    }
  }

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString('no-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading) {
    return <div className="p-8">Laster renhold...</div>
  }

  const checkedRoomIds = new Set(todaysChecks.map((c) => c.room_id))
  const totalHistoryPages = Math.max(1, Math.ceil(recentChecks.length / PAGE_SIZE))
  const pagedHistory = recentChecks.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE)

  return (
    <div className="max-w-[1440px] p-6">
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
            <IconBadge icon={<SprayCan className="size-4" />} />
            Renhold
          </h1>
          <p className="text-muted-foreground text-sm">Status og historikk for renhold.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {groups.map((group) => (
            <Button key={group.id} variant="outline" size="sm" onClick={() => handlePrintGroup(group)}>
              <Printer />
              QR: {group.name}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {groups.map((group) => {
          const companyName = companies.find((c) => c.id === group.company_id)?.name
          const groupRooms = rooms.filter((r) => r.group_id === group.id)
          return (
            <div key={group.id} className="rounded-xl border border-border overflow-hidden">
              <div className="bg-brand-cream dark:bg-white/5 p-3 flex items-center justify-between gap-2">
                <p className="font-semibold text-brand-navy dark:text-white">{group.name}</p>
                <Select value={group.company_id ?? 'none'} onValueChange={(val) => val && handleChangeGroupCompany(group.id, val)}>
                  <SelectTrigger className="w-36 h-8 shrink-0">
                    <SelectValue placeholder="Ikke satt" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ikke satt</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!companyName && (
                <p className="text-xs text-muted-foreground px-3 pt-2">Ingen ansvarlig satt</p>
              )}
              <div className="flex flex-col divide-y divide-border">
                {groupRooms.map((room) => {
                  const done = checkedRoomIds.has(room.id)
                  return (
                    <div key={room.id} className="flex items-center justify-between gap-2 p-3">
                      <p className="text-sm truncate">{room.name}</p>
                      {done ? (
                        <Badge className="bg-green-600 hover:bg-green-700 shrink-0">utført</Badge>
                      ) : (
                        <Badge variant="destructive">mangler</Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <h2 className="text-lg font-semibold mb-3">Historikk</h2>
      {recentChecks.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">Ingen registreringer enda.</p>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-border rounded-md border border-input mb-3">
            {pagedHistory.map((c) => {
              const hasDetails = !!c.deviation_note || c.deviation_photos.length > 0
              const isExpanded = expandedCheckId === c.id
              return (
                <div key={c.id} className="p-3">
                  <div
                    className={`flex items-center justify-between gap-3 ${hasDetails ? 'cursor-pointer' : ''}`}
                    onClick={() => hasDetails && handleToggleExpand(c)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-base md:text-sm truncate">{c.cleaning_rooms?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(c.checked_at)}{c.checked_by_name ? ` · ${c.checked_by_name}` : ''}
                      </p>
                    </div>
                    {hasDetails && (
                      <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                        {c.deviation_photos.length > 0 && <ImageIcon className="size-4" />}
                        {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </div>
                    )}
                  </div>
                  {isExpanded && hasDetails && (
                    <div className="mt-3 space-y-2 rounded-md bg-muted/40 p-3">
                      {c.deviation_note && <p className="text-sm">{c.deviation_note}</p>}
                      {c.deviation_photos.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {c.deviation_photos.map((path) =>
                            photoUrls[path] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={path} src={photoUrls[path]} alt="Avvik" className="size-24 rounded-md object-cover border border-border" />
                            ) : (
                              <div key={path} className="size-24 rounded-md bg-muted animate-pulse" />
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <Pagination page={historyPage} totalPages={totalHistoryPages} onPageChange={setHistoryPage} />
        </>
      )}
    </div>
  )
}
