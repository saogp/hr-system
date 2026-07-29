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

type PersonInfo = { full_name: string | null; email: string | null }

export default function PersonUniformHistoryPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [person, setPerson] = useState<PersonInfo | null>(null)
  const [issuances, setIssuances] = useState<UniformIssuance[]>([])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!isAdminLike(applyRoleOverride(viewerProfile?.role ?? 'employee'))) {
        router.replace('/')
        return
      }

      const { data: personData } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', id)
        .single()
      if (personData) setPerson(personData)

      const { data: issuanceData } = await supabase
        .from('uniform_issuances')
        .select('*')
        .eq('profile_id', id)
        .not('employee_signed_at', 'is', null)
        .order('employee_signed_at', { ascending: false })
      if (issuanceData) setIssuances(issuanceData as unknown as UniformIssuance[])

      setLoading(false)
    }

    load()
  }, [id, router])

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) {
    return <div className="p-8">Laster...</div>
  }

  return (
    <div className="p-6 md:p-12 max-w-lg">
      <Link
        href="/uniformer"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Tilbake til personalutstyr
      </Link>

      <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2 mb-1">
        <IconBadge icon={<Package className="size-4" />} />
        {person?.full_name || person?.email || 'Utstyr'}
      </h1>
      <p className="text-muted-foreground text-sm mb-6">Signerte utleveringer og signaturer.</p>

      {issuances.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ingen signerte utleveringer enda.</p>
      ) : (
        <div className="space-y-4">
          {issuances.map((i) => (
            <div key={i.id} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-600 hover:bg-green-700">Signert</Badge>
                <span className="text-xs text-muted-foreground">{formatDate(i.employee_signed_at!)}</span>
              </div>
              <div className="flex flex-col gap-1">
                {i.items.map((item) => (
                  <span key={item.id} className="text-sm text-muted-foreground">
                    {needsCardCredentials(item.type)
                      ? `${item.type}${item.card_number ? ` (nr. ${item.card_number})` : ''}`
                      : `${item.type}${item.size !== 'Ingen' ? ` (${item.size})` : ''}${item.quantity > 1 ? ` x${item.quantity}` : ''}`}
                    {item.returned && ' · Returnert'}
                  </span>
                ))}
              </div>
              {i.employee_signature && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={i.employee_signature} alt="Signatur" className="w-full rounded-md border border-input bg-white" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
