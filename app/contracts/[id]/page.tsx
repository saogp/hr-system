'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle2, MoreHorizontal, Download, Send, Trash2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  extractTokens,
  getMissingProfileFields,
  renderContract,
  type ProfileFields,
  type CompanyFields,
} from '@/lib/contract-tokens'
import { downloadContractPdf } from '@/lib/contract-pdf'
import { RenderedContractText } from '@/components/rendered-contract-text'
import { SignaturePad } from '@/components/signature-pad'
import { PhoneInput } from '@/components/phone-input'
import { useToastManager } from '@/components/ui/toast'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { sendNotification } from '@/lib/notifications'
import { DetailPageSkeleton } from '@/components/ui/loading-skeletons'

function formatBankAccount(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 11)].filter(Boolean).join('.')
}

function formatPersonnummer(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  return [digits.slice(0, 6), digits.slice(6, 11)].filter(Boolean).join(' ')
}

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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

type Contract = {
  id: string
  admin_fields: Record<string, string>
  employee_signed_at: string | null
  employee_signature: string | null
  admin_signed_at: string | null
  admin_signature: string | null
  admin_signed_by: string | null
  sent_at: string
  updated_at: string
  sent_to_accountant_at: string | null
  profile_id: string
  company_id: string | null
  created_by: string | null
  template_id: string | null
  pdf_path: string | null
  personnummer: string | null
  contract_templates: { name: string; content: string } | null
}

type PersonInfo = { id: string; full_name: string | null; email: string | null; avatar_url: string | null }

function getInitials(name: string) {
  const parts = name.split(' ').filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? ''
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const toastManager = useToastManager()
  const [contract, setContract] = useState<Contract | null>(null)
  const [profile, setProfile] = useState<ProfileFields | null>(null)
  const [company, setCompany] = useState<CompanyFields | null>(null)
  const [employeeInfo, setEmployeeInfo] = useState<PersonInfo | null>(null)
  const [creatorInfo, setCreatorInfo] = useState<PersonInfo | null>(null)
  const [adminSignerInfo, setAdminSignerInfo] = useState<PersonInfo | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isRealAdmin, setIsRealAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sendingToAccountant, setSendingToAccountant] = useState(false)

  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [personnummer, setPersonnummer] = useState('')
  const [showPersonnummer, setShowPersonnummer] = useState(false)
  const [legacyPdfUrl, setLegacyPdfUrl] = useState<string | null>(null)

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
      const viewerRole = applyRoleOverride(viewerProfile?.role ?? 'employee')
      setIsAdmin(isAdminLike(viewerRole))
      setIsRealAdmin(viewerRole === 'admin')

      const { data: contractData } = await supabase
        .from('contracts')
        .select('*, contract_templates!contracts_template_id_fkey(name, content)')
        .eq('id', id)
        .single()

      if (!contractData) {
        router.replace('/contracts')
        return
      }
      const typedContract = contractData as unknown as Contract
      setContract(typedContract)
      setPersonnummer(typedContract.personnummer ?? '')

      if (!typedContract.template_id && typedContract.pdf_path) {
        const { data: { session } } = await supabase.auth.getSession()
        const pdfRes = await fetch('/api/contracts/pdf-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
          body: JSON.stringify({ contractId: id }),
        })
        if (pdfRes.ok) {
          const { url } = await pdfRes.json()
          setLegacyPdfUrl(url)
        }
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email, birth_date, address, phone, bank_account, title, avatar_url')
        .eq('id', contractData.profile_id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setPhone(profileData.phone ?? '')
        setAddress(profileData.address ?? '')
        setBankAccount(profileData.bank_account ?? '')
        setEmployeeInfo({
          id: contractData.profile_id,
          full_name: profileData.full_name,
          email: profileData.email,
          avatar_url: profileData.avatar_url,
        })
      }

      if (contractData.created_by) {
        const { data: creator } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .eq('id', contractData.created_by)
          .single()
        if (creator) setCreatorInfo(creator)
      }

      if (contractData.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('name, org_number, billing_address')
          .eq('id', contractData.company_id)
          .single()
        if (companyData) setCompany(companyData)
      }

      if (contractData.admin_signed_by) {
        const { data: signer } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .eq('id', contractData.admin_signed_by)
          .single()
        if (signer) setAdminSignerInfo(signer)
      }

      setLoading(false)
    }

    load()
  }, [id, router])

  const isEmployeeOwner = currentUserId === contract?.profile_id

  const handleSaveProfileFields = async () => {
    if (!contract) return
    await supabase
      .from('profiles')
      .update({ phone, address, bank_account: bankAccount })
      .eq('id', contract.profile_id)
    setProfile(prev => prev ? { ...prev, phone, address, bank_account: bankAccount } : prev)
  }

  const handleEmployeeSign = async (signatureDataUrl: string) => {
    if (!contract) return
    setSigning(true)

    await handleSaveProfileFields()

    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('contracts')
      .update({ employee_signed_at: nowIso, employee_signature: signatureDataUrl, personnummer })
      .eq('id', contract.id)

    if (!error) {
      setContract(prev => prev ? { ...prev, employee_signed_at: nowIso, employee_signature: signatureDataUrl, personnummer } : prev)
      toastManager.add({ title: 'Kontrakt signert', description: 'Signaturen din er registrert.' })
      if (contract.created_by) {
        sendNotification({
          recipientId: contract.created_by,
          type: 'contract_signed',
          title: 'Kontrakt signert',
          body: `${profile?.full_name || 'Ansatt'} signerte "${contract.contract_templates?.name || 'Kontrakt'}"`,
          link: `/contracts/${contract.id}`,
        })
      }
    }
    setSigning(false)
  }

  const handleAdminSign = async (signatureDataUrl: string) => {
    if (!contract || !currentUserId) return
    setSigning(true)

    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('contracts')
      .update({ admin_signed_at: nowIso, admin_signature: signatureDataUrl, admin_signed_by: currentUserId })
      .eq('id', contract.id)

    if (!error) {
      setContract(prev => prev ? {
        ...prev,
        admin_signed_at: nowIso,
        admin_signature: signatureDataUrl,
        admin_signed_by: currentUserId,
      } : prev)

      const { data: me } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', currentUserId)
        .single()
      if (me) setAdminSignerInfo(me)
      toastManager.add({ title: 'Kontrakt signert', description: 'Signaturen din er registrert.' })
    }
    setSigning(false)
  }

  const handleDelete = async () => {
    if (!contract) return
    setDeleting(true)

    const { error } = await supabase.from('contracts').delete().eq('id', contract.id)

    if (!error) {
      router.replace('/contracts')
    } else {
      toastManager.add({ title: 'Kunne ikke slette kontrakten', description: error.message })
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const handleResendEmail = async () => {
    if (!contract) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/contracts/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ contractId: contract.id }),
    })
    if (res.ok) {
      toastManager.add({ title: 'E-post sendt på nytt', description: `Sendt til ${employeeInfo?.email ?? 'den ansatte'}.` })
    } else {
      const result = await res.json().catch(() => ({}))
      toastManager.add({ title: 'Kunne ikke sende e-posten på nytt', description: result.error || 'Noe gikk galt.' })
    }
  }

  const handleSendToAccountant = async () => {
    if (!contract) return
    setSendingToAccountant(true)

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/contracts/send-to-accountant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: JSON.stringify({ contractId: contract.id }),
    })

    if (!res.ok) {
      const result = await res.json().catch(() => ({}))
      toastManager.add({ title: 'Kunne ikke sende til regnskapsfører', description: result.error || 'Noe gikk galt.' })
      setSendingToAccountant(false)
      return
    }

    const nowIso = new Date().toISOString()
    const { error } = await supabase
      .from('contracts')
      .update({ sent_to_accountant_at: nowIso })
      .eq('id', contract.id)
    if (!error) {
      setContract(prev => prev ? { ...prev, sent_to_accountant_at: nowIso } : prev)
      toastManager.add({ title: 'Sendt til regnskapsfører' })
    }
    setSendingToAccountant(false)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString('no-NO', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  if (loading || !contract || !profile) {
    return <DetailPageSkeleton />
  }

  if (!contract.template_id) {
    return (
      <div className="p-6 max-w-[1440px] space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Historisk kontrakt</h1>
              <p className="text-muted-foreground text-sm">Sendt {formatDate(contract.sent_at)}</p>
            </div>
            {(isAdmin || isEmployeeOwner) && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreHorizontal />
                      <span className="sr-only">Handlinger</span>
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => legacyPdfUrl && window.open(legacyPdfUrl, '_blank')}
                    disabled={!legacyPdfUrl}
                  >
                    <Download />
                    Last ned som PDF
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={handleSendToAccountant} disabled={sendingToAccountant}>
                      <Send />
                      {sendingToAccountant ? 'Sender...' : 'Send til regnskapsfører'}
                    </DropdownMenuItem>
                  )}
                  {isRealAdmin && (
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                      <Trash2 />
                      Slett kontrakt
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="rounded-md border border-input p-4 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ansatt</p>
              <div className="flex items-center gap-2">
                <Avatar className="size-8">
                  {employeeInfo?.avatar_url && <AvatarImage src={employeeInfo.avatar_url} alt={employeeInfo.full_name ?? ''} />}
                  <AvatarFallback className="text-xs">{getInitials(employeeInfo?.full_name || '?')}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{employeeInfo?.full_name || '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{employeeInfo?.email}</p>
                </div>
              </div>
            </div>

            {creatorInfo && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Lastet opp av</p>
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    {creatorInfo.avatar_url && <AvatarImage src={creatorInfo.avatar_url} alt={creatorInfo.full_name ?? ''} />}
                    <AvatarFallback className="text-xs">{getInitials(creatorInfo.full_name || '?')}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{creatorInfo.full_name || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{creatorInfo.email}</p>
                  </div>
                </div>
              </div>
            )}

            {isAdmin && contract.sent_to_accountant_at && (
              <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                Sendt til regnskapsfører {formatDate(contract.sent_to_accountant_at)}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-input overflow-hidden" style={{ height: '80vh' }}>
          {legacyPdfUrl ? (
            <iframe src={legacyPdfUrl} className="w-full h-full" title="Kontrakt PDF" />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Henter PDF...
            </div>
          )}
        </div>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
              <AlertDialogDescription>
                Dette vil slette den historiske kontrakten for{' '}
                {employeeInfo?.full_name || employeeInfo?.email || 'denne ansatte'} permanent.
                Handlingen kan ikke angres.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Avbryt</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? 'Sletter...' : 'Slett'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  if (!contract.contract_templates) {
    return <DetailPageSkeleton />
  }
  const template = contract.contract_templates
  const usedTokens = extractTokens(template.content)
  const editableFields = [
    { token: 'telefon', label: 'Telefon', value: phone, setValue: setPhone },
    { token: 'adresse', label: 'Adresse', value: address, setValue: setAddress },
    { token: 'kontonummer', label: 'Kontonummer', value: bankAccount, setValue: setBankAccount },
  ].filter(f => usedTokens.includes(f.token))

  const effectiveProfile: ProfileFields = { ...profile, phone, address, bank_account: bankAccount }
  const missingFields = getMissingProfileFields(template.content, effectiveProfile)
  const bankAccountDigits = bankAccount.replace(/\D/g, '')
  const bankAccountInvalid = usedTokens.includes('kontonummer') && bankAccountDigits.length > 0 && bankAccountDigits.length !== 11
  const personnummerDigits = personnummer.replace(/\D/g, '')
  const personnummerMissing = personnummerDigits.length === 0
  const personnummerInvalid = !personnummerMissing && personnummerDigits.length !== 11
  const renderedText = renderContract(template.content, effectiveProfile, contract.admin_fields, company)

  const signedCount = [contract.employee_signed_at, contract.admin_signed_at].filter(Boolean).length
  const allSigned = signedCount === 2

  const handleDownloadPdf = () => {
    if (!contract) return
    downloadContractPdf(template.name, `Sendt ${formatDate(contract.sent_at)}`, renderedText)
  }

  return (
    <div className="p-6 max-w-[1440px] space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{template.name}</h1>
            <p className="text-muted-foreground text-sm">Sendt {formatDate(contract.sent_at)}</p>
          </div>
          {(isAdmin || isEmployeeOwner) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreHorizontal />
                    <span className="sr-only">Handlinger</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownloadPdf}>
                  <Download />
                  Last ned som PDF
                </DropdownMenuItem>
                {isAdmin && !contract.employee_signed_at && (
                  <DropdownMenuItem onClick={handleResendEmail}>
                    <Send />
                    Send e-post på nytt
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={handleSendToAccountant} disabled={sendingToAccountant}>
                    <Send />
                    {sendingToAccountant ? 'Sender...' : 'Send til regnskapsfører'}
                  </DropdownMenuItem>
                )}
                {isRealAdmin && (
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 />
                    Slett kontrakt
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="rounded-md border border-input p-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Ansatt</p>
            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                {employeeInfo?.avatar_url && <AvatarImage src={employeeInfo.avatar_url} alt={employeeInfo.full_name ?? ''} />}
                <AvatarFallback className="text-xs">{getInitials(employeeInfo?.full_name || '?')}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{employeeInfo?.full_name || '—'}</p>
                <p className="text-xs text-muted-foreground truncate">{employeeInfo?.email}</p>
              </div>
            </div>
          </div>

          {creatorInfo && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ansvarlig</p>
              <div className="flex items-center gap-2">
                <Avatar className="size-8">
                  {creatorInfo.avatar_url && <AvatarImage src={creatorInfo.avatar_url} alt={creatorInfo.full_name ?? ''} />}
                  <AvatarFallback className="text-xs">{getInitials(creatorInfo.full_name || '?')}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{creatorInfo.full_name || '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{creatorInfo.email}</p>
                </div>
              </div>
            </div>
          )}

          {isAdmin && contract.sent_to_accountant_at && (
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              Sendt til regnskapsfører {formatDate(contract.sent_to_accountant_at)}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
      <div className="space-y-6 min-w-0">
        {isEmployeeOwner && !contract.employee_signed_at && (
          <div className="rounded-md border border-input p-4 space-y-4">
            <h2 className="font-medium">Fyll ut din informasjon</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="personnummer">Personnummer</Label>
                <div className="relative">
                  <Input
                    id="personnummer"
                    type={showPersonnummer ? 'text' : 'password'}
                    value={personnummer}
                    onChange={(e) => setPersonnummer(formatPersonnummer(e.target.value))}
                    placeholder="DDMMÅÅ NNNNN"
                    className="pr-9"
                    aria-invalid={personnummerInvalid}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPersonnummer((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPersonnummer ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    <span className="sr-only">{showPersonnummer ? 'Skjul' : 'Vis'} personnummer</span>
                  </button>
                </div>
                {personnummerInvalid && (
                  <p className="text-xs text-destructive">Personnummer skal ha 11 siffer (har {personnummerDigits.length}).</p>
                )}
                <p className="text-[11px] text-muted-foreground">Brukes kun for denne kontrakten, vises ikke andre steder.</p>
              </div>
              {editableFields.map((f) => {
                const bankAccountDigits = f.token === 'kontonummer' ? f.value.replace(/\D/g, '') : ''
                const bankAccountError =
                  f.token === 'kontonummer' && bankAccountDigits.length > 0 && bankAccountDigits.length !== 11
                    ? `Kontonummer skal ha 11 siffer (har ${bankAccountDigits.length}).`
                    : null

                return (
                  <div key={f.token} className="flex flex-col gap-1.5">
                    <Label htmlFor={f.token}>{f.label}</Label>
                    {f.token === 'telefon' ? (
                      <PhoneInput value={f.value || null} onCommit={(val) => f.setValue(val ?? '')} />
                    ) : f.token === 'kontonummer' ? (
                      <>
                        <Input
                          id={f.token}
                          value={f.value}
                          onChange={(e) => f.setValue(formatBankAccount(e.target.value))}
                          placeholder="1234.56.78903"
                          aria-invalid={!!bankAccountError}
                        />
                        {bankAccountError && <p className="text-xs text-destructive">{bankAccountError}</p>}
                      </>
                    ) : (
                      <Input id={f.token} value={f.value} onChange={(e) => f.setValue(e.target.value)} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="rounded-md border border-input p-4 text-base md:text-sm">
          <RenderedContractText text={renderedText} />
        </div>

        {isEmployeeOwner && !contract.employee_signed_at && (
          <div className="space-y-2">
            <h2 className="font-medium text-sm">Din signatur</h2>
            {missingFields.length > 0 ? (
              <p className="text-sm text-destructive">
                Fyll ut følgende før du kan signere: {missingFields.join(', ')}.
              </p>
            ) : bankAccountInvalid ? (
              <p className="text-sm text-destructive">
                Kontonummer skal ha 11 siffer (har {bankAccountDigits.length}).
              </p>
            ) : personnummerMissing || personnummerInvalid ? (
              <p className="text-sm text-destructive">
                {personnummerMissing
                  ? 'Fyll ut personnummer før du kan signere.'
                  : `Personnummer skal ha 11 siffer (har ${personnummerDigits.length}).`}
              </p>
            ) : (
              <SignaturePad onSave={handleEmployeeSign} saving={signing} />
            )}
          </div>
        )}

        {isAdmin && !contract.admin_signed_at && (
          <div className="space-y-2">
            <h2 className="font-medium text-sm">Signer som ansvarlig</h2>
            {missingFields.length > 0 ? (
              <p className="text-sm text-destructive">
                Ansatt mangler å fylle ut: {missingFields.join(', ')}.
              </p>
            ) : bankAccountInvalid ? (
              <p className="text-sm text-destructive">
                Kontonummer skal ha 11 siffer (har {bankAccountDigits.length}).
              </p>
            ) : personnummerMissing || personnummerInvalid ? (
              <p className="text-sm text-destructive">
                {personnummerMissing
                  ? 'Ansatt mangler å fylle ut personnummer.'
                  : `Personnummer skal ha 11 siffer (har ${personnummerDigits.length}).`}
              </p>
            ) : (
              <SignaturePad onSave={handleAdminSign} saving={signing} />
            )}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="rounded-md border border-input p-4 space-y-3">
          <div className="flex items-center gap-2">
            {allSigned && <CheckCircle2 className="size-4 text-green-600" />}
            <p className="text-sm font-medium">{signedCount} av 2 har signert</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="size-7">
                  {employeeInfo?.avatar_url && <AvatarImage src={employeeInfo.avatar_url} alt={employeeInfo.full_name ?? ''} />}
                  <AvatarFallback className="text-xs">{getInitials(employeeInfo?.full_name || '?')}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm truncate">{employeeInfo?.full_name || '—'}</p>
                  {contract.employee_signed_at && (
                    <p className="text-xs text-muted-foreground">Signert {formatDate(contract.employee_signed_at)}</p>
                  )}
                </div>
              </div>
              {contract.employee_signed_at && <CheckCircle2 className="size-4 shrink-0 text-green-600" />}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="size-7">
                  {(adminSignerInfo?.avatar_url || creatorInfo?.avatar_url) && (
                    <AvatarImage
                      src={adminSignerInfo?.avatar_url || creatorInfo?.avatar_url || ''}
                      alt={adminSignerInfo?.full_name || creatorInfo?.full_name || ''}
                    />
                  )}
                  <AvatarFallback className="text-xs">
                    {getInitials(adminSignerInfo?.full_name || creatorInfo?.full_name || '?')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm truncate">{adminSignerInfo?.full_name || creatorInfo?.full_name || 'Ansvarlig'}</p>
                  {contract.admin_signed_at && (
                    <p className="text-xs text-muted-foreground">Signert {formatDate(contract.admin_signed_at)}</p>
                  )}
                </div>
              </div>
              {contract.admin_signed_at && <CheckCircle2 className="size-4 shrink-0 text-green-600" />}
            </div>
          </div>

          {contract.employee_signature && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ansattes signatur</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={contract.employee_signature} alt="Ansattes signatur" className="w-full rounded-md border border-input bg-white" />
            </div>
          )}
          {contract.admin_signature && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ansvarliges signatur</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={contract.admin_signature} alt="Ansvarliges signatur" className="w-full rounded-md border border-input bg-white" />
            </div>
          )}

          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Sendt av {creatorInfo?.full_name || '—'} {formatDate(contract.sent_at)}
            <br />
            Oppdatert {formatDateTime(contract.updated_at)}
          </p>
        </div>
      </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette kontrakten "{template.name}" for{' '}
              {employeeInfo?.full_name || employeeInfo?.email || 'denne ansatte'} permanent.
              Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Sletter...' : 'Slett'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
