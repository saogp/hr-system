'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  extractTokens,
  getMissingProfileFields,
  renderContract,
  type ProfileFields,
} from '@/lib/contract-tokens'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

type Contract = {
  id: string
  admin_fields: Record<string, string>
  confirmed_at: string | null
  sent_at: string
  profile_id: string
  contract_templates: { name: string; content: string }
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [contract, setContract] = useState<Contract | null>(null)
  const [profile, setProfile] = useState<ProfileFields | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [bankAccount, setBankAccount] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      setCurrentUserId(user.id)

      const { data: contractData } = await supabase
        .from('contracts')
        .select('*, contract_templates!contracts_template_id_fkey(name, content)')
        .eq('id', id)
        .single()

      if (!contractData) {
        router.replace('/contracts')
        return
      }
      setContract(contractData as unknown as Contract)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email, birth_date, address, phone, bank_account')
        .eq('id', contractData.profile_id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setPhone(profileData.phone ?? '')
        setAddress(profileData.address ?? '')
        setBankAccount(profileData.bank_account ?? '')
      }

      setLoading(false)
    }

    load()
  }, [id, router])

  const handleConfirm = async () => {
    if (!contract || !profile) return
    setConfirming(true)

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ phone, address, bank_account: bankAccount })
      .eq('id', contract.profile_id)

    if (profileError) {
      setConfirming(false)
      return
    }

    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('contracts')
      .update({ confirmed_at: nowIso })
      .eq('id', contract.id)

    if (!error) {
      setProfile(prev => prev ? { ...prev, phone, address, bank_account: bankAccount } : prev)
      setContract(prev => prev ? { ...prev, confirmed_at: nowIso } : prev)
    }

    setConfirming(false)
  }

  if (loading || !contract || !profile) {
    return <div className="p-8">Laster kontrakt...</div>
  }

  const isOwner = currentUserId === contract.profile_id
  const usedTokens = extractTokens(contract.contract_templates.content)

  const editableFields = [
    { token: 'telefon', label: 'Telefon', value: phone, setValue: setPhone },
    { token: 'adresse', label: 'Adresse', value: address, setValue: setAddress },
    { token: 'kontonummer', label: 'Kontonummer', value: bankAccount, setValue: setBankAccount },
  ].filter(f => usedTokens.includes(f.token))

  const effectiveProfile: ProfileFields = {
    ...profile,
    phone,
    address,
    bank_account: bankAccount,
  }

  const missingFields = getMissingProfileFields(contract.contract_templates.content, effectiveProfile)
  const renderedText = renderContract(contract.contract_templates.content, effectiveProfile, contract.admin_fields)

  return (
    <div className="container mx-auto py-10 px-4 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{contract.contract_templates.name}</h1>
        <p className="text-muted-foreground text-sm">
          Sendt {new Date(contract.sent_at).toLocaleDateString('no-NO')}
        </p>
      </div>

      {isOwner && !contract.confirmed_at && editableFields.length > 0 && (
        <div className="rounded-md border border-input p-4 space-y-4">
          <h2 className="font-medium">Fyll ut din informasjon</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {editableFields.map((f) => (
              <div key={f.token} className="flex flex-col gap-1.5">
                <Label htmlFor={f.token}>{f.label}</Label>
                <Input
                  id={f.token}
                  value={f.value}
                  onChange={(e) => f.setValue(e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-md border border-input p-4 whitespace-pre-wrap text-sm">
        {renderedText}
      </div>

      {isOwner && (
        contract.confirmed_at ? (
          <Badge className="bg-green-600 hover:bg-green-700 w-fit">
            Bekreftet {new Date(contract.confirmed_at).toLocaleDateString('no-NO')}
          </Badge>
        ) : (
          <Button
            disabled={missingFields.length > 0 || confirming}
            onClick={handleConfirm}
          >
            {confirming ? 'Bekrefter...' : 'Jeg godkjenner'}
          </Button>
        )
      )}
    </div>
  )
}
