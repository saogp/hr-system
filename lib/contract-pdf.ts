import jsPDF from 'jspdf'
import { supabase } from '@/lib/supabase'
import { renderContract, type ProfileFields, type CompanyFields } from '@/lib/contract-tokens'
import { formatDate } from '@/lib/format-date'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[æå]/g, 'a')
    .replace(/ø/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'kontrakt'
}

export type ContractSignature = {
  name: string | null
  signedAt: string | null
  signatureDataUrl: string | null
}

export function downloadContractPdf(
  templateName: string,
  sentLabel: string,
  renderedText: string,
  signatures?: { employee?: ContractSignature | null; admin?: ContractSignature | null }
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const marginX = 48
  const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(templateName, marginX, 56)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(sentLabel, marginX, 74)
  doc.setTextColor(20)

  let y = 100
  const headingPattern = /^(#{1,2})\s(.*)$/

  for (const rawLine of renderedText.split('\n')) {
    const match = rawLine.match(headingPattern)
    const level = match ? match[1].length : 0
    const lineText = match ? match[2] : rawLine

    doc.setFont('helvetica', level > 0 ? 'bold' : 'normal')
    doc.setFontSize(level === 1 ? 15 : level === 2 ? 13 : 11)
    const lineHeight = level === 1 ? 20 : level === 2 ? 18 : 15

    const wrapped = doc.splitTextToSize(lineText || ' ', maxWidth) as string[]
    for (const w of wrapped) {
      if (y > pageHeight - 48) {
        doc.addPage()
        y = 56
      }
      doc.text(w, marginX, y)
      y += lineHeight
    }
    if (level > 0) y += 4
  }

  const signers = [signatures?.employee, signatures?.admin].filter(
    (s): s is ContractSignature => !!s?.signatureDataUrl
  )

  if (signers.length > 0) {
    const sigWidth = 200
    const sigHeight = 75

    if (y > pageHeight - 48) {
      doc.addPage()
      y = 56
    }
    y += 20
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text('Signaturer', marginX, y)
    y += 20

    for (const signer of signers) {
      if (y + sigHeight + 40 > pageHeight - 48) {
        doc.addPage()
        y = 56
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(120)
      doc.text(
        `${signer.name || 'Ukjent'}${signer.signedAt ? ` · Signert ${formatDate(signer.signedAt)}` : ''}`,
        marginX,
        y
      )
      doc.setTextColor(20)
      y += 8
      doc.addImage(signer.signatureDataUrl!, 'PNG', marginX, y, sigWidth, sigHeight)
      y += sigHeight + 24
    }
  }

  doc.save(`${slugify(templateName)}.pdf`)
}

type ContractForPdf = {
  sent_at: string
  admin_fields: Record<string, string> | null
  profile_id: string
  company_id: string | null
  personnummer: string | null
  employee_signed_at: string | null
  employee_signature: string | null
  admin_signed_at: string | null
  admin_signature: string | null
  admin_signed_by: string | null
  contract_templates: { name: string; content: string } | null
}

export async function fetchAndDownloadContractPdf(contractId: string) {
  const { data: contract } = await supabase
    .from('contracts')
    .select('sent_at, admin_fields, profile_id, company_id, personnummer, employee_signed_at, employee_signature, admin_signed_at, admin_signature, admin_signed_by, contract_templates!contracts_template_id_fkey(name, content)')
    .eq('id', contractId)
    .single()

  const typedContract = contract as unknown as ContractForPdf | null
  if (!typedContract?.contract_templates) return

  const { data: profileData } = await supabase
    .from('profiles')
    .select('full_name, email, birth_date, address, phone, bank_account, title')
    .eq('id', typedContract.profile_id)
    .single()

  let adminName: string | null = null
  if (typedContract.admin_signed_by) {
    const { data: adminData } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', typedContract.admin_signed_by)
      .single()
    adminName = adminData?.full_name || adminData?.email || null
  }

  const profile: ProfileFields = {
    full_name: null,
    email: null,
    birth_date: null,
    address: null,
    phone: null,
    bank_account: null,
    title: null,
    ...profileData,
    personnummer: typedContract.personnummer,
  }

  let company: CompanyFields | null = null
  if (typedContract.company_id) {
    const { data: companyData } = await supabase
      .from('companies')
      .select('name, org_number, billing_address')
      .eq('id', typedContract.company_id)
      .single()
    company = companyData ?? null
  }

  const renderedText = renderContract(
    typedContract.contract_templates.content,
    profile,
    typedContract.admin_fields ?? {},
    company
  )

  const sentLabel = `Sendt ${formatDate(typedContract.sent_at)}`
  downloadContractPdf(typedContract.contract_templates.name, sentLabel, renderedText, {
    employee: {
      name: profile.full_name,
      signedAt: typedContract.employee_signed_at,
      signatureDataUrl: typedContract.employee_signature,
    },
    admin: {
      name: adminName,
      signedAt: typedContract.admin_signed_at,
      signatureDataUrl: typedContract.admin_signature,
    },
  })
}
