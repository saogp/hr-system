'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MoreHorizontal, FileText, MessageSquare, Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { applyRoleOverride } from '@/lib/role-override'

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getPushSubscription } from '@/lib/push-client'

type Company = {
  id: string
  name: string
  org_number: string | null
  billing_address: string | null
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

export default function SettingsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const [editTarget, setEditTarget] = useState<Company | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrgNumber, setEditOrgNumber] = useState('')
  const [editBillingAddress, setEditBillingAddress] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [templateDeleteId, setTemplateDeleteId] = useState<string | null>(null)
  const [deletingTemplate, setDeletingTemplate] = useState(false)

  const [reviewTemplates, setReviewTemplates] = useState<ReviewTemplate[]>([])
  const [reviewTemplateDeleteId, setReviewTemplateDeleteId] = useState<string | null>(null)
  const [deletingReviewTemplate, setDeletingReviewTemplate] = useState(false)

  const [newMalOpen, setNewMalOpen] = useState(false)
  const [newMalType, setNewMalType] = useState<'kontrakt' | 'samtale'>('kontrakt')
  const [newMalBasis, setNewMalBasis] = useState('blank')
  const [creatingMal, setCreatingMal] = useState(false)

  useEffect(() => {
    async function checkAccessAndLoad() {
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

      const admin = applyRoleOverride(profile?.role ?? 'employee') === 'admin'
      setIsAdmin(admin)

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
      }

      if (isPushSupported()) {
        const existing = await getPushSubscription()
        setPushEnabled(!!existing)
      }

      setLoading(false)
    }

    checkAccessAndLoad()
  }, [router])

  const handleTogglePush = async () => {
    setPushBusy(true)
    setPushError('')

    try {
      if (pushEnabled) {
        await unsubscribeFromPush()
        setPushEnabled(false)
      } else {
        await subscribeToPush()
        setPushEnabled(true)
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Noe gikk galt.')
    }

    setPushBusy(false)
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
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setSaving(true)

    const { error } = await supabase
      .from('companies')
      .update({ name: editName, org_number: editOrgNumber, billing_address: editBillingAddress })
      .eq('id', editTarget.id)

    if (!error) {
      setCompanies(prev => prev.map(c => (
        c.id === editTarget.id
          ? { ...c, name: editName, org_number: editOrgNumber, billing_address: editBillingAddress }
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

    if (newMalBasis === 'blank') {
      router.push(newMalType === 'kontrakt' ? '/contracts/templates/new' : '/reviews/templates/new')
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
      }
    } else {
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
      }
    }

    setCreatingMal(false)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) {
    return <div className="p-8">Laster innstillinger...</div>
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
          <IconBadge icon={<Settings className="size-4" />} />
          Innstillinger
        </h1>
        <p className="text-muted-foreground text-sm">
          {isAdmin ? 'Administrer bedriftsinformasjon, maler og varsler.' : 'Administrer dine varsler.'}
        </p>
      </div>

      <Tabs defaultValue={isAdmin ? 'bedrifter' : 'varsler'}>
        <TabsList>
          {isAdmin && <TabsTrigger value="bedrifter">Bedrifter</TabsTrigger>}
          {isAdmin && <TabsTrigger value="maler">Maler</TabsTrigger>}
          <TabsTrigger value="varsler">Varsler</TabsTrigger>
        </TabsList>

        <TabsContent value="varsler" className="pt-4 max-w-md">
          <h2 className="text-lg font-semibold mb-2">Push-varsler</h2>
          <p className="text-muted-foreground text-sm mb-4">
            Få varsler direkte på denne enheten (mobil eller PC) for ting som medarbeidersamtaler,
            nye oppgaver og si fra-meldinger. Du må aktivere dette på hver enhet du vil bruke.
            {' '}
            <span className="font-medium">På iPhone må siden være lagt til på Hjem-skjermen</span> for at
            varsler skal fungere i Safari.
          </p>
          {pushError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{pushError}</AlertDescription>
            </Alert>
          )}
          {!isPushSupported() ? (
            <p className="text-sm text-muted-foreground">Push-varsler støttes ikke i denne nettleseren.</p>
          ) : (
            <Button
              onClick={handleTogglePush}
              disabled={pushBusy}
              variant={pushEnabled ? 'outline' : 'default'}
              className={pushEnabled ? '' : 'bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium'}
            >
              {pushBusy ? 'Vent...' : pushEnabled ? 'Skru av varsler på denne enheten' : 'Aktiver varsler på denne enheten'}
            </Button>
          )}
        </TabsContent>

        {isAdmin && (
        <TabsContent value="bedrifter" className="pt-4">
          <div className="flex flex-row items-center justify-between mb-4">
            <p className="text-muted-foreground text-sm">
              Bedriftsinformasjon fylles automatisk inn i kontrakter som bruker firma-felt.
            </p>
            <Button onClick={handleAddCompany} className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium">
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
                    <p className="font-medium text-sm truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.org_number || '—'}{c.billing_address ? ` · ${c.billing_address}` : ''}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" className="shrink-0">
                          <MoreHorizontal />
                          <span className="sr-only">Handlinger</span>
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(c)}>
                        Rediger
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargetId(c.id)}>
                        Slett
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        )}

        {isAdmin && (
        <TabsContent value="maler" className="pt-4">
          <div className="flex flex-row items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Ferdige maler</h2>
            <Button
              onClick={() => { setNewMalType('kontrakt'); setNewMalBasis('blank'); setNewMalOpen(true) }}
              className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
            >
              Ny mal
            </Button>
          </div>

          {templates.length === 0 && reviewTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Ingen maler registrert enda.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((t) => (
                <Card
                  key={`contract-${t.id}`}
                  className="shadow-none cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/contracts/templates/${t.id}`)}
                >
                  <CardContent className="pt-4 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <FileText className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(t.created_at)}</p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
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
                          <DropdownMenuItem onClick={() => router.push(`/contracts/templates/${t.id}`)}>
                            Rediger
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setTemplateDeleteId(t.id)}>
                            Slett
                          </DropdownMenuItem>
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
                  <CardContent className="pt-4 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <MessageSquare className="size-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(t.created_at)}</p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
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
                          <DropdownMenuItem onClick={() => router.push(`/reviews/templates/${t.id}`)}>
                            Rediger
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setReviewTemplateDeleteId(t.id)}>
                            Slett
                          </DropdownMenuItem>
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
                  setNewMalType(val as 'kontrakt' | 'samtale')
                  setNewMalBasis('blank')
                }}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="kontrakt" id="maltype-kontrakt" />
                  <Label htmlFor="maltype-kontrakt" className="font-normal">Kontraktmal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="samtale" id="maltype-samtale" />
                  <Label htmlFor="maltype-samtale" className="font-normal">Samtalemal</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Start fra</Label>
              <Select value={newMalBasis} onValueChange={(val) => val && setNewMalBasis(val)}>
                <SelectTrigger className="w-full h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">Blank mal</SelectItem>
                  {(newMalType === 'kontrakt' ? templates : reviewTemplates).map((t) => (
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
    </div>
  )
}
