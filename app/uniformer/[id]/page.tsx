'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { needsCardCredentials, type UniformIssuance } from '@/lib/uniform-items'
import { IconBadge } from '@/components/ui/icon-badge'
import { Badge } from '@/components/ui/badge'
import { SignaturePad } from '@/components/signature-pad'
import { useToastManager } from '@/components/ui/toast'
import { DetailPageSkeleton } from '@/components/ui/loading-skeletons'
import { sendNotification } from '@/lib/notifications'

type PersonInfo = { full_name: string | null; email: string | null }

export default function UniformIssuancePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toastManager = useToastManager()

  const [issuance, setIssuance] = useState<UniformIssuance | null>(null)
  const [employee, setEmployee] = useState<PersonInfo | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      setCurrentUserId(user.id)

      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setIsAdmin(isAdminLike(applyRoleOverride(viewerProfile?.role ?? 'employee')))

      const { data: issuanceData } = await supabase
        .from('uniform_issuances')
        .select('*')
        .eq('id', id)
        .single()

      if (!issuanceData) {
        router.replace('/')
        return
      }
      setIssuance(issuanceData as unknown as UniformIssuance)

      const { data: employeeData } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', issuanceData.profile_id)
        .single()
      if (employeeData) setEmployee(employeeData)

      setLoading(false)
    }

    load()
  }, [id, router])

  const handleSign = async (signatureDataUrl: string) => {
    if (!issuance) return
    setSigning(true)

    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('uniform_issuances')
      .update({ employee_signed_at: nowIso, employee_signature: signatureDataUrl })
      .eq('id', issuance.id)

    if (!error) {
      setIssuance(prev => prev ? { ...prev, employee_signed_at: nowIso, employee_signature: signatureDataUrl } : prev)
      toastManager.add({ title: 'Mottak bekreftet', description: 'Signaturen din er registrert.' })
      if (issuance.created_by) {
        sendNotification({
          recipientId: issuance.created_by,
          type: 'uniform_confirmed',
          title: 'Personalutstyr bekreftet',
          body: `${employee?.full_name || 'Ansatt'} bekreftet mottak av personalutstyr.`,
          link: `/uniformer/${issuance.id}`,
        })
      }
    }
    setSigning(false)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading || !issuance) {
    return <DetailPageSkeleton />
  }

  const isOwner = currentUserId === issuance.profile_id

  return (
    <div className="p-6 max-w-[1440px]">
      <Link
        href={isAdmin ? '/uniformer' : '/'}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Tilbake
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2 mb-1">
        <IconBadge icon={<Package className="size-4" />} />
        Utlevering
      </h1>
      <p className="text-muted-foreground text-sm mb-6">
        Til {employee?.full_name || employee?.email || '—'} · {formatDate(issuance.created_at)}
      </p>

      <div className="rounded-md border border-input divide-y divide-border mb-6">
        {issuance.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 p-3">
            <div>
              <p className="text-base md:text-sm">
                {item.type}
                {!needsCardCredentials(item.type) && item.size !== 'Ingen' && ` (${item.size})`}
                {!needsCardCredentials(item.type) && item.quantity > 1 && ` x${item.quantity}`}
              </p>
              {needsCardCredentials(item.type) && (item.card_number || item.card_password) && (
                <p className="text-xs text-muted-foreground">
                  {item.card_number && `Nr. ${item.card_number}`}
                  {item.card_number && item.card_password && ' · '}
                  {item.card_password && `Passord: ${item.card_password}`}
                </p>
              )}
            </div>
            {item.returned && <Badge variant="secondary">Returnert</Badge>}
          </div>
        ))}
      </div>

      {issuance.employee_signed_at ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-green-600 hover:bg-green-700">Bekreftet mottatt</Badge>
            <span className="text-xs text-muted-foreground">{formatDate(issuance.employee_signed_at)}</span>
          </div>
          {issuance.employee_signature && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={issuance.employee_signature} alt="Signatur" className="w-full rounded-md border border-input bg-white" />
          )}
        </div>
      ) : isOwner || isAdmin ? (
        <div className="space-y-2">
          <h2 className="font-medium text-sm">Bekreft mottak med signatur</h2>
          {isAdmin && !isOwner && (
            <p className="text-xs text-muted-foreground">
              La den ansatte signere direkte på denne enheten — da slipper dere å vente på e-post.
            </p>
          )}
          <SignaturePad onSave={handleSign} saving={signing} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Venter på at ansatt bekrefter mottak.</p>
      )}
    </div>
  )
}
