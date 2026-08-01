'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MoreHorizontal, FileText, MessageSquare, ClipboardList, Settings, Plus, X, SprayCan, Download } from 'lucide-react'
import { downloadGroupQrCode } from '@/lib/cleaning-qr'
import type { CleaningRecipient } from '@/lib/cleaning'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'
import { NOTIFICATION_TYPES, type NotificationType, type NotificationPrefs } from '@/lib/notifications'
import { Switch } from '@/components/ui/switch'
import { SURVEY_TEMPLATES } from '@/lib/survey-templates'
import { PageHeaderSkeleton, CardGridSkeleton } from '@/components/ui/loading-skeletons'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { POSITION_OPTIONS } from '@/lib/position-options'
import { Checkbox } from '@/components/ui/checkbox'

type Company = {
  id: string
  name: string
  org_number: string | null
  billing_address: string | null
  accountant_email: string | null
}

type Template = {
  id: string
  name: string
  created_at: string
}

type ReviewTemplate = {
  id: string
  name: string
  created_at: string
}

type SurveyTemplateRow = {
  id: string
  name: string
  questions: unknown
  anonymous: boolean
  created_at: string
}

type CleaningGroupRow = {
  id: string
  name: string
  questions: unknown
}

type EmployeeOption = {
  id: string
  full_name: string | null
  email: string | null
  title: string | null
}

type BroadcastMessage = {
  id: string
  subject: string
  message: string
  recipient_count: number
  pdf_url: string | null
  pdf_filename: string | null
  created_at: string
  profiles: { full_name: string | null; email: string | null } | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isRealAdmin, setIsRealAdmin] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const [cleaningRecipients, setCleaningRecipients] = useState<CleaningRecipient[]>([])
  const [cleaningGroups, setCleaningGroups] = useState<CleaningGroupRow[]>([])
  const [cleaningGroupDeleteId, setCleaningGroupDeleteId] = useState<string | null>(null)
  const [deletingCleaningGroup, setDeletingCleaningGroup] = useState(false)
  const [newCleaningRecipientEmail, setNewCleaningRecipientEmail] = useState('')
  const [sendingCleaningSummary, setSendingCleaningSummary] = useState(false)
  const [cleaningSummaryMessage, setCleaningSummaryMessage] = useState('')

  const [editTarget, setEditTarget] = useState<Company | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrgNumber, setEditOrgNumber] = useState('')
  const [editBillingAddress, setEditBillingAddress] = useState('')
  const [editAccountantEmail, setEditAccountantEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [templateDeleteId, setTemplateDeleteId] = useState<string | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState(false)

  const [reviewTemplates, setReviewTemplates] = useState<ReviewTemplate[]>([])
  const [reviewTemplateDeleteId, setReviewTemplateDeleteId] = useState<string | null>(null)
  const [deletingReviewTemplate, setDeletingReviewTemplate] = useState(false)

  const [surveyTemplates, setSurveyTemplates] = useState<SurveyTemplateRow[]>([])
  const [surveyTemplateDeleteId, setSurveyTemplateDeleteId] = useState<string | null>(null)
  const [deletingSurveyTemplate, setDeletingSurveyTemplate] = useState(false)

  const [newMalOpen, setNewMalOpen] = useState(false)
  const [newMalType, setNewMalType] = useState<'kontrakt' | 'samtale' | 'undersokelse' | 'renhold'>('kontrakt')
  const [newMalBasis, setNewMalBasis] = useState('blank')
  const [creatingMal, setCreatingMal] = useState(false)

  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastPdf, setBroadcastPdf] = useState<File | null>(null)
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastError, setBroadcastError] = useState('')
  const [broadcastSuccess, setBroadcastSuccess] = useState('')
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastMessage[]>([])
  const [broadcastEmployees, setBroadcastEmployees] = useState<EmployeeOption[]>([])
  const [broadcastAudience, setBroadcastAudience] = useState<'all' | 'title' | 'custom'>('all')
  const [broadcastTitles, setBroadcastTitles] = useState<string[]>([])
  const [broadcastRecipientIds, setBroadcastRecipientIds] = useState<string[]>([])

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({})


  const loadBroadcastHistory = async () => {
    const { data: broadcastData } = await supabase
      .from('broadcast_messages')
      .select('id, subject, message, recipient_count, pdf_url, pdf_filename, created_at, profiles!broadcast_messages_sender_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
    if (broadcastData) setBroadcastHistory(broadcastData as unknown as BroadcastMessage[])
  }

  useEffect(() => {
    async function checkAccessAndLoad() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, notification_prefs')
        .eq('id', user.id)
        .single()

      const viewerRole = applyRoleOverride(profile?.role ?? 'employee')
      const admin = isAdminLike(viewerRole)
      setIsAdmin(admin)
      setIsRealAdmin(viewerRole === 'admin')
      setCurrentUserId(user.id)
      setNotificationPrefs((profile?.notification_prefs as NotificationPrefs) ?? {})

      if (admin) {
        const { data: companiesData } = await supabase
          .from('companies')
          .select('*')
          .order('name')
        if (companiesData) setCompanies(companiesData)

        const { data: templatesData } = await supabase
          .from('contract_templates')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
        if (templatesData) setTemplates(templatesData)

        const { data: reviewTemplatesData } = await supabase
          .from('review_templates')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
        if (reviewTemplatesData) setReviewTemplates(reviewTemplatesData)

        const { data: surveyTemplatesData } = await supabase
          .from('survey_templates')
          .select('id, name, questions, anonymous, created_at')
          .order('created_at', { ascending: false })
        if (surveyTemplatesData) setSurveyTemplates(surveyTemplatesData)

        await loadBroadcastHistory()

        const { data: employeesData } = await supabase
          .from('profiles')
          .select('id, full_name, email, title')
          .neq('id', user.id)
          .order('full_name')
        if (employeesData) setBroadcastEmployees(employeesData)

        const { data: recipientsData } = await supabase
          .from('cleaning_notification_recipients')
          .select('id, email')
          .order('email')
        if (recipientsData) setCleaningRecipients(recipientsData)

        const { data: cleaningGroupsData } = await supabase
          .from('cleaning_room_groups')
          .select('id, name, questions')
          .order('sort_order')
        if (cleaningGroupsData) setCleaningGroups(cleaningGroupsData)
      }

      setLoading(false)
    }

    checkAccessAndLoad()
  }, [router])

  const handleToggleNotificationPref = async (type: NotificationType, channel: 'email' | 'push', enabled: boolean) => {
    if (!currentUserId) return
    const next: NotificationPrefs = {
      ...notificationPrefs,
      [type]: { ...notificationPrefs[type], [channel]: enabled },
    }
    setNotificationPrefs(next)
    await supabase.from('profiles').update({ notification_prefs: next }).eq('id', currentUserId)
  }

  const handleAddCompany = async () => {
    const { data, error } = await supabase
      .from('companies')
      .insert({ name: 'Ny bedrift' })
      .select()
      .single()

    if (!error && data) {
      setCompanies(prev => [...prev, data])
    }
  }

  const openEdit = (company: Company) => {
    setEditTarget(company)
    setEditName(company.name)
    setEditOrgNumber(company.org_number ?? '')
    setEditBillingAddress(company.billing_address ?? '')
    setEditAccountantEmail(company.accountant_email ?? '')
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)

    const { error } = await supabase
      .from('companies')
      .update({ name: editName, org_number: editOrgNumber, billing_address: editBillingAddress, accountant_email: editAccountantEmail || null })
      .eq('id', editTarget.id)

    if (!error) {
      setCompanies(prev => prev.map(c => (
        c.id === editTarget.id
          ? { ...c, name: editName, org_number: editOrgNumber, billing_address: editBillingAddress, accountant_email: editAccountantEmail || null }
          : c
      )))
      setEditTarget(null)
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleteTargetId) return
    setDeleting(true)

    const { error } = await supabase.from('companies').delete().eq('id', deleteTargetId)

    if (!error) {
      setCompanies(prev => prev.filter(c => c.id !== deleteTargetId))
      setDeleteTargetId(null)
    } else {
      alert('Kunne ikke slette bedriften. Den er trolig i bruk av ansatte eller kontrakter.')
    }
    setDeleting(false)
  }

  const handleDeleteTemplate = async () => {
    if (!templateDeleteId) return
    setDeletingTemplate(true)

    const { error } = await supabase.from('contract_templates').delete().eq('id', templateDeleteId)

    if (!error) {
      setTemplates(prev => prev.filter(t => t.id !== templateDeleteId))
      setTemplateDeleteId(null)
    } else {
      alert('Kunne ikke slette malen. Den er trolig i bruk av en eller flere kontrakter.')
    }
    setDeletingTemplate(false)
  }

  const handleDeleteReviewTemplate = async () => {
    if (!reviewTemplateDeleteId) return
    setDeletingReviewTemplate(true)

    const { error } = await supabase.from('review_templates').delete().eq('id', reviewTemplateDeleteId)

    if (!error) {
      setReviewTemplates(prev => prev.filter(t => t.id !== reviewTemplateDeleteId))
      setReviewTemplateDeleteId(null)
    } else {
      alert('Kunne ikke slette malen.')
    }
    setDeletingReviewTemplate(false)
  }

  const handleCreateMal = async () => {
    setCreatingMal(true)

    const blankRoute: Record<typeof newMalType, string> = {
      kontrakt: '/contracts/templates/new',
      samtale: '/reviews/templates/new',
      undersokelse: '/surveys/templates/new',
      renhold: '/renhold/sjekkliste/new',
    }

    if (newMalBasis === 'blank') {
      router.push(blankRoute[newMalType])
      return
    }

    if (newMalType === 'kontrakt') {
      const { data: source } = await supabase
        .from('contract_templates')
        .select('name, content')
        .eq('id', newMalBasis)
        .single()

      if (source) {
        const { data, error } = await supabase
          .from('contract_templates')
          .insert({ name: `${source.name} (kopi)`, content: source.content })
          .select()
          .single()

        if (!error && data) {
          router.push(`/contracts/templates/${data.id}`)
          return
        }
        alert('Kunne ikke opprette malen.')
      } else {
        alert('Fant ikke malen som skal kopieres.')
      }
    } else if (newMalType === 'samtale') {
      const { data: source } = await supabase
        .from('review_templates')
        .select('name, questions')
        .eq('id', newMalBasis)
        .single()

      if (source) {
        const { data, error } = await supabase
          .from('review_templates')
          .insert({ name: `${source.name} (kopi)`, questions: source.questions })
          .select()
          .single()

        if (!error && data) {
          router.push(`/reviews/templates/${data.id}`)
          return
        }
        alert('Kunne ikke opprette malen.')
      } else {
        alert('Fant ikke malen som skal kopieres.')
      }
    } else if (newMalType === 'undersokelse') {
      const { data: source } = await supabase
        .from('survey_templates')
        .select('name, questions, anonymous')
        .eq('id', newMalBasis)
        .single()

      if (source) {
        const { data, error } = await supabase
          .from('survey_templates')
          .insert({ name: `${source.name} (kopi)`, questions: source.questions, anonymous: source.anonymous })
          .select()
          .single()

        if (!error && data) {
          router.push(`/surveys/templates/${data.id}`)
          return
        }
        alert('Kunne ikke opprette malen.')
      } else {
        alert('Fant ikke malen som skal kopieres.')
      }
    } else {
      const { data: source } = await supabase
        .from('cleaning_room_groups')
        .select('name, questions')
        .eq('id', newMalBasis)
        .single()

      if (source) {
        const { data: existing } = await supabase
          .from('cleaning_room_groups')
          .select('sort_order')
          .order('sort_order', { ascending: false })
          .limit(1)
          .single()

        const { data, error } = await supabase
          .from('cleaning_room_groups')
          .insert({ name: `${source.name} (kopi)`, questions: source.questions, sort_order: (existing?.sort_order ?? 0) + 1 })
          .select()
          .single()

        if (!error && data) {
          router.push(`/renhold/sjekkliste/${data.id}`)
          return
        }
        alert('Kunne ikke opprette malen.')
      } else {
        alert('Fant ikke malen som skal kopieres.')
      }
    }

    setCreatingMal(false)
  }

  const handleDeleteSurveyTemplate = async () => {
    if (!surveyTemplateDeleteId) return
    setDeletingSurveyTemplate(true)

    const { error } = await supabase.from('survey_templates').delete().eq('id', surveyTemplateDeleteId)

    if (!error) {
      setSurveyTemplates(prev => prev.filter(t => t.id !== surveyTemplateDeleteId))
      setSurveyTemplateDeleteId(null)
    } else {
      alert('Kunne ikke slette malen.')
    }
    setDeletingSurveyTemplate(false)
  }

  const handleDeleteCleaningGroup = async () => {
    if (!cleaningGroupDeleteId) return
    setDeletingCleaningGroup(true)

    const { error } = await supabase.from('cleaning_room_groups').delete().eq('id', cleaningGroupDeleteId)

    if (!error) {
      setCleaningGroups(prev => prev.filter(g => g.id !== cleaningGroupDeleteId))
      setCleaningGroupDeleteId(null)
    } else {
      alert('Kunne ikke slette malen. Den er trolig i bruk av rom eller registreringer.')
    }
    setDeletingCleaningGroup(false)
  }

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    setSendingBroadcast(true)
    setBroadcastError('')
    setBroadcastSuccess('')

    const { data: { session } } = await supabase.auth.getSession()
    const formData = new FormData()
    formData.append('subject', broadcastSubject)
    formData.append('message', broadcastMessage)
    if (broadcastPdf) formData.append('pdf', broadcastPdf)
    if (broadcastAudience === 'custom') {
      formData.append('recipientIds', JSON.stringify(broadcastRecipientIds))
    } else if (broadcastAudience === 'title') {
      formData.append('titles', JSON.stringify(broadcastTitles))
    }

    const res = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: formData,
    })

    const result = await res.json().catch(() => ({}))

    if (!res.ok) {
      setBroadcastError(result.error || 'Kunne ikke sende meldingen.')
    } else {
      setBroadcastSuccess(`Sendt til ${result.sentCount} ansatte.`)
      setBroadcastSubject('')
      setBroadcastMessage('')
      setBroadcastPdf(null)
      setBroadcastAudience('all')
      setBroadcastTitles([])
      setBroadcastRecipientIds([])
      await loadBroadcastHistory()
    }

    setSendingBroadcast(false)
  }

  const handleAddCleaningRecipient = async () => {
    if (!newCleaningRecipientEmail.trim()) return
    const { error } = await supabase.from('cleaning_notification_recipients').insert({ email: newCleaningRecipientEmail.trim() })
    if (!error) {
      setNewCleaningRecipientEmail('')
      const { data } = await supabase.from('cleaning_notification_recipients').select('id, email').order('email')
      if (data) setCleaningRecipients(data)
    }
  }

  const handleRemoveCleaningRecipient = async (id: string) => {
    await supabase.from('cleaning_notification_recipients').delete().eq('id', id)
    setCleaningRecipients((prev) => prev.filter((r) => r.id !== id))
  }

  const handleSendCleaningSummaryNow = async () => {
    setSendingCleaningSummary(true)
    setCleaningSummaryMessage('')

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/cleaning/daily-summary', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    const result = await res.json().catch(() => ({}))

    setCleaningSummaryMessage(res.ok ? (result.message || 'Sendt.') : (result.error || 'Noe gikk galt.'))
    setSendingCleaningSummary(false)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) {
    return (
      <div className="max-w-[1440px] p-6">
        <PageHeaderSkeleton />
        <CardGridSkeleton />
      </div>
    )
  }

  return (
    <div className="max-w-[1440px] p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
          <IconBadge icon={<Settings className="size-4" />} />
          Innstillinger
        </h1>
        <p className="text-muted-foreground text-sm">
          {isAdmin ? 'Administrer bedriftsinformasjon, maler og varsler.' : 'Administrer dine varsler.'}
        </p>
      </div>

      <Tabs defaultValue={isAdmin ? 'maler' : 'varsler'}>
        <TabsList>
          {isAdmin && <TabsTrigger value="maler">Maler</TabsTrigger>}
          {isAdmin && <TabsTrigger value="bedrifter">Bedrifter</TabsTrigger>}
          {isAdmin && <TabsTrigger value="meldinger">Meldinger</TabsTrigger>}
          <TabsTrigger value="varsler">Varsler</TabsTrigger>
        </TabsList>

        <TabsContent value="varsler" className="pt-4 max-w-lg">
          <p className="text-sm text-muted-foreground mb-3">
            Varsler sendes på e-post og i bjellen øverst på siden. Gjøremål på dashbordet kan ikke slås av.
          </p>

          <div className="rounded-xl border border-border bg-white dark:bg-white/5 overflow-hidden">
            <div className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 px-4 py-2 bg-muted/50">
              <span className="text-xs font-medium text-muted-foreground">Hendelse</span>
              <span className="text-xs font-medium text-muted-foreground text-center">E-post</span>
              <span className="text-xs font-medium text-muted-foreground text-center">Bjelle</span>
            </div>
            <div className="divide-y divide-border">
              {(Object.keys(NOTIFICATION_TYPES) as NotificationType[]).map((type) => (
                <div key={type} className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-2 px-4 py-2.5">
                  <span className="text-sm truncate">{NOTIFICATION_TYPES[type]}</span>
                  <div className="flex justify-center">
                    <Switch
                      checked={notificationPrefs[type]?.email !== false}
                      onCheckedChange={(val) => handleToggleNotificationPref(type, 'email', val)}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Switch
                      checked={notificationPrefs[type]?.push !== false}
                      onCheckedChange={(val) => handleToggleNotificationPref(type, 'push', val)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {isAdmin && (
              <>
                <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border bg-muted/50">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-orange/15">
                    <SprayCan className="size-3.5 text-brand-navy dark:text-brand-orange" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Renhold – daglig oppsummering</p>
                    <p className="text-xs text-muted-foreground">
                      E-post om hvilke rom som ikke er rengjort i dag, til valgte mottakere.
                    </p>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex flex-col gap-2">
                    {cleaningRecipients.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Ingen mottakere lagt til enda.</p>
                    ) : (
                      cleaningRecipients.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-input p-2">
                          <span className="text-sm truncate">{r.email}</span>
                          <Button variant="ghost" size="icon-sm" onClick={() => handleRemoveCleaningRecipient(r.id)}>
                            <X />
                            <span className="sr-only">Fjern</span>
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      placeholder="navn@firma.no"
                      value={newCleaningRecipientEmail}
                      onChange={(e) => setNewCleaningRecipientEmail(e.target.value)}
                    />
                    <Button variant="outline" onClick={handleAddCleaningRecipient} className="shrink-0">
                      <Plus />
                      Legg til
                    </Button>
                  </div>

                  {cleaningSummaryMessage && <p className="text-sm text-muted-foreground">{cleaningSummaryMessage}</p>}
                  <Button
                    onClick={handleSendCleaningSummaryNow}
                    disabled={sendingCleaningSummary || cleaningRecipients.length === 0}
                    variant="outline"
                  >
                    {sendingCleaningSummary ? 'Sender...' : 'Send oppsummering nå'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {isAdmin && (
        <TabsContent value="bedrifter" className="pt-4">
          <div className="flex flex-col gap-3 mb-4">
            <p className="text-muted-foreground text-sm">
              Bedriftsinformasjon fylles automatisk inn i kontrakter som bruker firma-felt.
            </p>
            <Button onClick={handleAddCompany} className="w-fit bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium">
              Ny bedrift
            </Button>
          </div>
          {companies.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Ingen bedrifter registrert enda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {companies.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-base md:text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.org_number || '—'}{c.billing_address ? ` · ${c.billing_address}` : ''}
                    </p>
                  </div>
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
                      <DropdownMenuItem onClick={() => openEdit(c)}>
                        Rediger
                      </DropdownMenuItem>
                      {isRealAdmin && (
                        <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargetId(c.id)}>
                          Slett
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        )}

        {isAdmin && (
        <TabsContent value="meldinger" className="pt-4 max-w-lg">
          <p className="text-muted-foreground text-sm mb-4">
            Send en e-post til alle ansatte samtidig, med valgfritt PDF-vedlegg.
          </p>

          {broadcastError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{broadcastError}</AlertDescription>
            </Alert>
          )}
          {broadcastSuccess && (
            <Alert className="mb-4">
              <AlertDescription>{broadcastSuccess}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSendBroadcast} className="flex flex-col gap-4 mb-8">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="broadcast-subject">Emne</Label>
              <Input
                id="broadcast-subject"
                value={broadcastSubject}
                onChange={(e) => setBroadcastSubject(e.target.value)}
                placeholder='F.eks. «Innkalling til personalmøte»'
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="broadcast-message">Melding</Label>
              <Textarea
                id="broadcast-message"
                className="min-h-32"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder='Skriv meldingen her. «Hei fornavn» og signatur legges til automatisk.'
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Mottakere</Label>
              <RadioGroup
                value={broadcastAudience}
                onValueChange={(val) => val && setBroadcastAudience(val as typeof broadcastAudience)}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="audience-all" />
                  <Label htmlFor="audience-all" className="font-normal">Alle ansatte</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="title" id="audience-title" />
                  <Label htmlFor="audience-title" className="font-normal">Etter stilling</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="custom" id="audience-custom" />
                  <Label htmlFor="audience-custom" className="font-normal">Egendefinert</Label>
                </div>
              </RadioGroup>

              {broadcastAudience === 'title' && (
                <div className="flex flex-col gap-2 rounded-md border border-input p-3 mt-1">
                  {POSITION_OPTIONS.map((option) => {
                    const checkboxId = `broadcast-title-${option}`
                    return (
                      <div key={option} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          id={checkboxId}
                          checked={broadcastTitles.includes(option)}
                          onCheckedChange={(val) => {
                            setBroadcastTitles((prev) =>
                              val === true ? [...prev, option] : prev.filter((t) => t !== option)
                            )
                          }}
                        />
                        <Label htmlFor={checkboxId} className="font-normal">{option}</Label>
                      </div>
                    )
                  })}
                </div>
              )}

              {broadcastAudience === 'custom' && (
                <div className="thin-scrollbar flex flex-col gap-2 rounded-md border border-input p-3 mt-1 max-h-48 overflow-y-auto">
                  {broadcastEmployees.map((emp) => {
                    const checkboxId = `broadcast-recipient-${emp.id}`
                    return (
                      <div key={emp.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          id={checkboxId}
                          checked={broadcastRecipientIds.includes(emp.id)}
                          onCheckedChange={(val) => {
                            setBroadcastRecipientIds((prev) =>
                              val === true ? [...prev, emp.id] : prev.filter((id) => id !== emp.id)
                            )
                          }}
                        />
                        <Label htmlFor={checkboxId} className="font-normal">{emp.full_name || emp.email}</Label>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="broadcast-pdf">PDF-vedlegg (valgfritt)</Label>
              <Input
                id="broadcast-pdf"
                type="file"
                accept="application/pdf"
                onChange={(e) => setBroadcastPdf(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button
              type="submit"
              disabled={
                sendingBroadcast ||
                !broadcastSubject.trim() ||
                !broadcastMessage.trim() ||
                (broadcastAudience === 'title' && broadcastTitles.length === 0) ||
                (broadcastAudience === 'custom' && broadcastRecipientIds.length === 0)
              }
              className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium w-fit"
            >
              {sendingBroadcast ? 'Sender...' : 'Send melding'}
            </Button>
          </form>

          <h3 className="text-lg font-semibold mb-2">Historikk</h3>
          {broadcastHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen fellesmailer sendt enda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border rounded-md border border-input">
              {broadcastHistory.map((b) => (
                <div key={b.id} className="p-4 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base md:text-sm font-medium">{b.subject}</p>
                    <p className="text-xs text-muted-foreground shrink-0">{formatDate(b.created_at)}</p>
                  </div>
                  <p className="text-base md:text-sm text-muted-foreground whitespace-pre-wrap">{b.message}</p>
                  <p className="text-xs text-muted-foreground">
                    Sendt av {b.profiles?.full_name || b.profiles?.email || '—'} til {b.recipient_count} ansatte
                    {b.pdf_url && (
                      <>
                        {' · '}
                        <a href={b.pdf_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          {b.pdf_filename || 'Vedlegg'}
                        </a>
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        )}

        {isAdmin && (
        <TabsContent value="maler" className="pt-4">
          <div className="flex flex-col gap-3 mb-4">
            <p className="text-muted-foreground text-sm">
              Gjenbrukbare maler for kontrakter, samtaler, undersøkelser og renhold.
            </p>
            <Button
              onClick={() => { setNewMalType('kontrakt'); setNewMalBasis('blank'); setNewMalOpen(true) }}
              className="w-fit bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
            >
              Ny mal
            </Button>
          </div>

          {templates.length === 0 && reviewTemplates.length === 0 && surveyTemplates.length === 0 && SURVEY_TEMPLATES.length === 0 && cleaningGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Ingen maler registrert enda.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((t) => (
                <Card
                  key={`contract-${t.id}`}
                  className="shadow-none cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/contracts/templates/${t.id}`)}
                >
                  <CardContent className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">Kontraktmal</p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal />
                              <span className="sr-only">Handlinger</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/contracts/new?template=${t.id}`)}>
                            Bruk mal
                          </DropdownMenuItem>
                          {isRealAdmin && (
                            <DropdownMenuItem variant="destructive" onClick={() => setTemplateDeleteId(t.id)}>
                              Slett
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {reviewTemplates.map((t) => (
                <Card
                  key={`review-${t.id}`}
                  className="shadow-none cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/reviews/templates/${t.id}`)}
                >
                  <CardContent className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <MessageSquare className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">Medarbeidersamtalemal</p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal />
                              <span className="sr-only">Handlinger</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/reviews/new?template=${t.id}`)}>
                            Bruk mal
                          </DropdownMenuItem>
                          {isRealAdmin && (
                            <DropdownMenuItem variant="destructive" onClick={() => setReviewTemplateDeleteId(t.id)}>
                              Slett
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {surveyTemplates.map((t) => (
                <Card
                  key={`survey-${t.id}`}
                  className="shadow-none cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/surveys/templates/${t.id}`)}
                >
                  <CardContent className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <ClipboardList className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">Undersøkelsesmal</p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal />
                              <span className="sr-only">Handlinger</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/surveys/new?template=${t.id}`)}>
                            Bruk mal
                          </DropdownMenuItem>
                          {isRealAdmin && (
                            <DropdownMenuItem variant="destructive" onClick={() => setSurveyTemplateDeleteId(t.id)}>
                              Slett
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {SURVEY_TEMPLATES.map((t) => (
                <Card
                  key={`survey-builtin-${t.id}`}
                  className="shadow-none cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/surveys/new?template=${t.id}`)}
                >
                  <CardContent className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <ClipboardList className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{t.label}</p>
                        <p className="text-xs text-muted-foreground">Undersøkelsesmal</p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal />
                              <span className="sr-only">Handlinger</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/surveys/new?template=${t.id}`)}>
                            Bruk mal
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {cleaningGroups.map((g) => (
                <Card
                  key={`cleaning-${g.id}`}
                  className="shadow-none cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/renhold/sjekkliste/${g.id}`)}
                >
                  <CardContent className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <SprayCan className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{g.name}</p>
                        <p className="text-xs text-muted-foreground">Renholdsmal</p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal />
                              <span className="sr-only">Handlinger</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/renhold/sjekkliste/${g.id}`)}>
                            Bruk mal
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => downloadGroupQrCode(g)}>
                            <Download />
                            QR-kode
                          </DropdownMenuItem>
                          {isRealAdmin && (
                            <DropdownMenuItem variant="destructive" onClick={() => setCleaningGroupDeleteId(g.id)}>
                              Slett
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        )}
      </Tabs>

      <Dialog open={newMalOpen} onOpenChange={setNewMalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ny mal</DialogTitle>
            <DialogDescription>
              Velg om du vil lage en helt ny mal, eller fortsette fra en eksisterende.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Type mal</Label>
              <RadioGroup
                value={newMalType}
                onValueChange={(val) => {
                  setNewMalType(val as 'kontrakt' | 'samtale' | 'undersokelse' | 'renhold')
                  setNewMalBasis('blank')
                }}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="kontrakt" id="maltype-kontrakt" />
                  <Label htmlFor="maltype-kontrakt" className="font-normal">Kontraktmal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="samtale" id="maltype-samtale" />
                  <Label htmlFor="maltype-samtale" className="font-normal">Medarbeidersamtalemal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="undersokelse" id="maltype-undersokelse" />
                  <Label htmlFor="maltype-undersokelse" className="font-normal">Undersøkelsesmal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="renhold" id="maltype-renhold" />
                  <Label htmlFor="maltype-renhold" className="font-normal">Renholdsmal</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Start fra</Label>
              <Select value={newMalBasis} onValueChange={(val) => val && setNewMalBasis(val)}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Blank mal</SelectItem>
                  {(
                    newMalType === 'kontrakt' ? templates :
                    newMalType === 'samtale' ? reviewTemplates :
                    newMalType === 'undersokelse' ? surveyTemplates :
                    cleaningGroups
                  ).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                onClick={handleCreateMal}
                disabled={creatingMal}
                className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
              >
                {creatingMal ? 'Oppretter...' : 'Fortsett'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editTarget !== null} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rediger bedrift</DialogTitle>
            <DialogDescription>
              Denne informasjonen fylles automatisk inn i kontrakter som bruker firma-felt.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">Navn</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-org">Org.nr</Label>
              <Input id="edit-org" value={editOrgNumber} onChange={(e) => setEditOrgNumber(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-address">Fakturaadresse</Label>
              <Input id="edit-address" value={editBillingAddress} onChange={(e) => setEditBillingAddress(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-accountant-email">E-post regnskapsfører</Label>
              <Input
                id="edit-accountant-email"
                type="email"
                value={editAccountantEmail}
                onChange={(e) => setEditAccountantEmail(e.target.value)}
                placeholder="regnskap@firma.no"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving} className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium">
                {saving ? 'Lagrer...' : 'Lagre'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette bedriften permanent. Handlingen kan ikke angres.
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

      <AlertDialog open={templateDeleteId !== null} onOpenChange={(open) => !open && setTemplateDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette malen permanent. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deletingTemplate}
              onClick={handleDeleteTemplate}
            >
              {deletingTemplate ? 'Sletter...' : 'Slett'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reviewTemplateDeleteId !== null} onOpenChange={(open) => !open && setReviewTemplateDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette malen permanent. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deletingReviewTemplate}
              onClick={handleDeleteReviewTemplate}
            >
              {deletingReviewTemplate ? 'Sletter...' : 'Slett'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={surveyTemplateDeleteId !== null} onOpenChange={(open) => !open && setSurveyTemplateDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette malen permanent. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deletingSurveyTemplate}
              onClick={handleDeleteSurveyTemplate}
            >
              {deletingSurveyTemplate ? 'Sletter...' : 'Slett'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cleaningGroupDeleteId !== null} onOpenChange={(open) => !open && setCleaningGroupDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil slette malen permanent. Handlingen kan ikke angres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deletingCleaningGroup}
              onClick={handleDeleteCleaningGroup}
            >
              {deletingCleaningGroup ? 'Sletter...' : 'Slett'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
