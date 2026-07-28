'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { extractTokens, extractChoiceFields, renderContract, RESERVED_TOKENS, COMPANY_TOKENS, type ProfileFields, type CompanyFields } from '@/lib/contract-tokens'
import { RichTextEditor } from '@/components/template-editor/rich-text-editor'
import { RenderedContractText } from '@/components/rendered-contract-text'
import { applyRoleOverride, isAdminLike } from '@/lib/role-override'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const PREVIEW_PROFILE: ProfileFields = {
  full_name: 'Ola Nordmann',
  email: 'ola.nordmann@example.com',
  birth_date: '1990-01-01',
  address: 'Eksempelveien 1, 0001 Oslo',
  phone: '123 45 678',
  bank_account: '1234.56.78903',
  title: 'Servitør',
}

const PREVIEW_COMPANY: CompanyFields = {
  name: 'Eksempel AS',
  org_number: '123 456 789',
  billing_address: 'Storgata 1, 0001 Oslo',
}

export default function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const isNew = id === 'new'

  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

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
        router.replace('/contracts')
        return
      }

      if (!isNew) {
        const { data } = await supabase
          .from('contract_templates')
          .select('name, content')
          .eq('id', id)
          .single()

        if (!data) {
          router.replace('/contracts')
          return
        }
        setName(data.name)
        setContent(data.content)
        setLoading(false)
      }
    }

    load()
  }, [id, isNew, router])

  const handleSave = async () => {
    setSaving(true)

    if (isNew) {
      const { data, error } = await supabase
        .from('contract_templates')
        .insert({ name, content })
        .select()
        .single()

      if (!error && data) {
        router.replace(`/contracts/templates/${data.id}`)
      }
    } else {
      const { error } = await supabase
        .from('contract_templates')
        .update({ name, content })
        .eq('id', id)

      if (!error) {
        setSavedAt(new Date())
      }
    }

    setSaving(false)
  }

  if (loading) {
    return <div className="p-8">Laster mal...</div>
  }

  const fillTokens = extractTokens(content).filter(
    (t) => !['navn', 'epost', 'fodselsdato', 'adresse', 'telefon', 'kontonummer'].includes(t)
  )
  const choiceFields = extractChoiceFields(content)

  const previewAdminFields: Record<string, string> = {}
  for (const t of extractTokens(content)) {
    if (t in RESERVED_TOKENS || t in COMPANY_TOKENS) continue
    previewAdminFields[t] = 'Eksempel'
  }
  const previewText = renderContract(content, PREVIEW_PROFILE, previewAdminFields, PREVIEW_COMPANY)

  return (
    <div className="py-10 px-4 max-w-3xl">
      <Link
        href="/contracts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" />
        Tilbake til kontrakter
      </Link>

      <div className="flex flex-row items-center justify-between gap-4 mb-6">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Navn på mal"
          className="text-lg font-semibold h-10 border-none px-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center gap-3 shrink-0">
          {savedAt && (
            <span className="text-xs text-muted-foreground">
              Lagret {savedAt.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!content}>
            Forhåndsvis
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name || !content}
            className="bg-brand-orange hover:bg-brand-orange/90 text-brand-navy font-medium"
          >
            {saving ? 'Lagrer...' : 'Lagre'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 mb-4">
        <Label>Kontrakttekst</Label>
        <RichTextEditor value={content} onChange={setContent} />
      </div>

      <div className="rounded-md border border-input p-3 text-sm space-y-2">
        <p className="text-muted-foreground text-xs">
          Feltene navn, epost, fodselsdato, adresse, telefon og kontonummer hentes automatisk fra
          den ansattes profil. Bruk {'{{'}choice:nokkel:alternativ A|alternativ B{'}}'} for et
          enten/eller-valg.
        </p>
        {(fillTokens.length > 0 || choiceFields.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {fillTokens.map((t) => (
              <Badge key={t} variant="secondary">{t}</Badge>
            ))}
            {choiceFields.map((f) => (
              <Badge key={f.key} variant="secondary">{f.key} (valg)</Badge>
            ))}
          </div>
        )}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Forhåndsvisning</DialogTitle>
            <DialogDescription>
              Slik ser malen ut når den fylles ut, med eksempeldata i stedet for en ansatt.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto -mx-4 px-4 text-sm">
            <RenderedContractText text={previewText} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Lukk</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
