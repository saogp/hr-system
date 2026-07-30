'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Package } from 'lucide-react'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { getUniformTypeIcon, needsCardCredentials, type UniformIssuance } from '@/lib/uniform-items'
import { IconBadge } from '@/components/ui/icon-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Pagination, PAGE_SIZE } from '@/components/ui/pagination'

type IssuanceWithPerson = UniformIssuance & {
  profiles: { full_name: string | null; email: string | null } | null
}

export default function UniformerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [issuances, setIssuances] = useState<IssuanceWithPerson[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [isRealAdmin, setIsRealAdmin] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadIssuances = async () => {
    const { data } = await supabase
      .from('uniform_issuances')
      .select('*, profiles:profile_id(full_name, email)')
      .order('created_at', { ascending: false })
    if (data) setIssuances(data as unknown as IssuanceWithPerson[])
  }

  useEffect(() => {
    async function load() {
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

      const viewerRole = applyRoleOverride(profile?.role ?? 'employee')
      if (!isAdminLike(viewerRole)) {
        router.replace('/')
        return
      }
      setIsRealAdmin(viewerRole === 'admin')

      await loadIssuances()
      setLoading(false)
    }

    load()
  }, [router])

  useEffect(() => {
    setPage(1)
  }, [search])

  const handleMarkReturned = async (issuanceId: string, itemId: string) => {
    const issuance = issuances.find(i => i.id === issuanceId)
    if (!issuance) return

    const nextItems = issuance.items.map(i =>
      i.id === itemId ? { ...i, returned: true, returned_at: new Date().toISOString() } : i
    )
    const { error } = await supabase.from('uniform_issuances').update({ items: nextItems }).eq('id', issuanceId)
    if (!error) {
      setIssuances(prev => prev.map(i => (i.id === issuanceId ? { ...i, items: nextItems } : i)))
    }
  }

  const handleDeleteIssuance = async () => {
    if (!deleteTargetId) return
    setDeleting(true)

    const { error } = await supabase.from('uniform_issuances').delete().eq('id', deleteTargetId)
    if (!error) {
      setIssuances(prev => prev.filter(i => i.id !== deleteTargetId))
      setDeleteTargetId(null)
    }
    setDeleting(false)
  }

  if (loading) {
    return <div className="p-8">Laster uniformer...</div>
  }

  const stockByType = new Map<string, number>()
  for (const issuance of issuances) {
    if (!issuance.employee_signed_at) continue
    for (const item of issuance.items) {
      if (item.returned) continue
      stockByType.set(item.type, (stockByType.get(item.type) ?? 0) + item.quantity)
    }
  }

  const matchesSearch = (name: string) => name.toLowerCase().includes(search.toLowerCase())

  const unsignedIssuances = issuances.filter(
    i => !i.employee_signed_at && i.items.some(item => !item.returned)
       && matchesSearch(i.profiles?.full_name || i.profiles?.email || '')
  )

  type FlatItem = (typeof issuances)[number]['items'][number] & { issuanceId: string }
  const signedGroups = new Map<string, { profileName: string; items: FlatItem[] }>()
  for (const issuance of issuances) {
    if (!issuance.employee_signed_at) continue
    const profileName = issuance.profiles?.full_name || issuance.profiles?.email || '—'
    if (!matchesSearch(profileName)) continue
    const outstandingItems = issuance.items.filter(item => !item.returned)
    if (outstandingItems.length === 0) continue

    const flatItems: FlatItem[] = outstandingItems.map(item => ({ ...item, issuanceId: issuance.id }))
    const existing = signedGroups.get(issuance.profile_id)
    if (existing) {
      existing.items.push(...flatItems)
    } else {
      signedGroups.set(issuance.profile_id, {
        profileName,
        items: flatItems,
      })
    }
  }

  const signedGroupsArr = Array.from(signedGroups.entries())
  const totalRows = unsignedIssuances.length + signedGroupsArr.length
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
  const startIdx = (page - 1) * PAGE_SIZE
  const endIdx = startIdx + PAGE_SIZE
  const pagedUnsigned = unsignedIssuances.slice(startIdx, endIdx)
  const pagedSignedGroups = signedGroupsArr.slice(
    Math.max(0, startIdx - unsignedIssuances.length),
    Math.max(0, endIdx - unsignedIssuances.length)
  )

  return (
    <div className="max-w-3xl p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
          <IconBadge icon={<Package className="size-4" />} />
          Personalutstyr
        </h1>
        <p className="text-muted-foreground text-sm">
          Registrer utlevering og retur av uniform, adgangskort og annet utstyr.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Ute hos ansatte</h2>
        {stockByType.size === 0 ? (
          <p className="text-sm text-muted-foreground">Ingenting utlevert enda.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from(stockByType.entries()).map(([type, count]) => {
              const Icon = getUniformTypeIcon(type)
              return (
                <div
                  key={type}
                  className="flex items-center gap-3 rounded-2xl border border-brand-navy/10 bg-brand-cream dark:bg-white/5 p-3"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-orange/15">
                    <Icon className="size-4 text-brand-navy dark:text-brand-orange" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-brand-navy dark:text-white leading-none">{count}</p>
                    <p className="text-xs text-muted-foreground truncate">{type}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Utleveringer</h2>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <Input
            placeholder="Finn ansatt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <Button
            render={<Link href="/uniformer/new" />}
            className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium shrink-0"
          >
            Ny registrering
          </Button>
        </div>

        {unsignedIssuances.length === 0 && signedGroups.size === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            {search ? 'Ingen treff.' : 'Ingen utleveringer enda.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {pagedUnsigned.map((issuance) => (
              <Link
                key={issuance.id}
                href={`/uniformer/${issuance.id}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-brand-cream dark:bg-white/5 p-4 hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-base md:text-sm truncate">
                    {issuance.profiles?.full_name || issuance.profiles?.email || '—'}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary">Venter på signering</Badge>
                    {isRealAdmin && (
                      <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal />
                                <span className="sr-only">Handlinger</span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargetId(issuance.id)}>
                              Slett
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {issuance.items.filter(item => !item.returned).map((item) => (
                    <span key={item.id} className="text-sm text-muted-foreground">
                      {needsCardCredentials(item.type)
                        ? `${item.type}${item.card_number ? ` (nr. ${item.card_number})` : ''}`
                        : `${item.type}${item.size !== 'Ingen' ? ` (${item.size})` : ''}${item.quantity > 1 ? ` x${item.quantity}` : ''}`}
                    </span>
                  ))}
                </div>
              </Link>
            ))}

            {pagedSignedGroups.map(([profileId, group]) => (
              <Link
                key={profileId}
                href={`/uniformer/person/${profileId}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-brand-cream dark:bg-white/5 p-4 hover:bg-muted/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-base md:text-sm truncate">{group.profileName}</p>
                  <Badge className="bg-green-600 hover:bg-green-700 shrink-0">Signert</Badge>
                </div>
                <div className="flex flex-col gap-1.5">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {needsCardCredentials(item.type)
                          ? `${item.type}${item.card_number ? ` (nr. ${item.card_number})` : ''}`
                          : `${item.type}${item.size !== 'Ingen' ? ` (${item.size})` : ''}${item.quantity > 1 ? ` x${item.quantity}` : ''}`}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleMarkReturned(item.issuanceId, item.id)
                        }}
                      >
                        Merk som returnert
                      </Button>
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette utleveringen permanent. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDeleteIssuance}
            >
              {deleting ? 'Sletter...' : 'Slett'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
