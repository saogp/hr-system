'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SprayCan, Printer, ChevronDown, ChevronUp, ImageIcon, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { todayIsoDate, normalizeCleaningQuestions, type CleaningRoom, type CleaningRoomGroup, type CleaningCheck } from '@/lib/cleaning'
import { printGroupQrCode } from '@/lib/cleaning-qr'

import { IconBadge } from '@/components/ui/icon-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination'
import { RenholdPageSkeleton } from '@/components/ui/loading-skeletons'
import { FilterButton, FilterField, FilterChips } from '@/components/ui/filter-button'

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
  const [historySearch, setHistorySearch] = useState('')
  const [roomFilter, setRoomFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const loadGroups = async () => {
    const { data } = await supabase.from('cleaning_room_groups').select('id, name, sort_order, questions, company_id').order('sort_order')
    if (data) setGroups(data.map((g) => ({ ...g, questions: normalizeCleaningQuestions(g.questions ?? []) })))
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

  useEffect(() => {
    setHistoryPage(1)
  }, [historySearch, roomFilter, dateFrom, dateTo])

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
    return <RenholdPageSkeleton />
  }

  const checkedRoomIds = new Set(todaysChecks.map((c) => c.room_id))
  const filteredHistory = recentChecks.filter((c) => {
    if (historySearch) {
      const roomName = (c.cleaning_rooms?.name || '').toLowerCase()
      const checkedBy = (c.checked_by_name || '').toLowerCase()
      const q = historySearch.toLowerCase()
      if (!roomName.includes(q) && !checkedBy.includes(q)) return false
    }
    if (roomFilter !== 'all' && c.room_id !== roomFilter) return false
    if (dateFrom && c.check_date < dateFrom) return false
    if (dateTo && c.check_date > dateTo) return false
    return true
  })
  const historyFilterCount = [roomFilter !== 'all', !!dateFrom, !!dateTo].filter(Boolean).length
  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE))
  const pagedHistory = filteredHistory.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE)

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
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
      <div className="mb-4">
        {recentChecks.length > 0 && (
          <div className="flex flex-row items-center gap-3">
            <div className="relative sm:max-w-xs w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Søk etter rom eller navn..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-8 rounded-full"
              />
            </div>
            <FilterButton activeCount={historyFilterCount}>
              <FilterField label="Rom">
                <FilterChips
                  value={roomFilter}
                  onChange={setRoomFilter}
                  options={[
                    { value: 'all', label: 'Alle rom' },
                    ...rooms.map((r) => ({ value: r.id, label: r.name })),
                  ]}
                />
              </FilterField>
              <FilterField label="Fra dato">
                <DateInput value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full" />
              </FilterField>
              <FilterField label="Til dato">
                <DateInput value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full" />
              </FilterField>
              {historyFilterCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit self-start -mt-1"
                  onClick={() => { setRoomFilter('all'); setDateFrom(''); setDateTo('') }}
                >
                  Nullstill filter
                </Button>
              )}
            </FilterButton>
          </div>
        )}
      </div>
      {filteredHistory.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">
          {recentChecks.length === 0 ? 'Ingen registreringer enda.' : 'Ingen treff på filteret.'}
        </p>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-border rounded-md border border-input mb-3">
            {pagedHistory.map((c) => {
              const isExpanded = expandedCheckId === c.id
              return (
                <div key={c.id} className="p-3">
                  <div
                    className="flex items-center justify-between gap-3 cursor-pointer"
                    onClick={() => handleToggleExpand(c)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-base md:text-sm truncate">{c.cleaning_rooms?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(c.checked_at)}{c.checked_by_name ? ` · ${c.checked_by_name}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
                      {c.deviation_photos.length > 0 && <ImageIcon className="size-4" />}
                      {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-3 space-y-3 rounded-md bg-muted/40 p-3">
                      {c.checklist.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {c.checklist.map((item, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 text-sm">
                              <span>{item.question}</span>
                              {item.checked ? (
                                <Badge className="bg-green-600 hover:bg-green-700 shrink-0">utført</Badge>
                              ) : (
                                <Badge variant="destructive" className="shrink-0">ikke utført</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
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
