'use client'

import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, ChevronDown, Heading1, Heading2, Pilcrow } from 'lucide-react'

import { MergeField } from './merge-field-node'
import { ChoiceField } from './choice-field-node'
import { MergeSuggestion } from './merge-suggestion'
import { contentToDoc, docToContent, EMPLOYEE_FIELDS, COMPANY_FIELDS, labelForToken } from '@/lib/template-doc'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Props = {
  value: string
  onChange: (value: string) => void
}

export function RichTextEditor({ value, onChange }: Props) {
  const pendingRangeRef = useRef<{ from: number; to: number } | null>(null)

  const [customFieldOpen, setCustomFieldOpen] = useState(false)
  const [customFieldKey, setCustomFieldKey] = useState('')

  const [choiceFieldOpen, setChoiceFieldOpen] = useState(false)
  const [choiceKey, setChoiceKey] = useState('')
  const [choiceOptionA, setChoiceOptionA] = useState('')
  const [choiceOptionB, setChoiceOptionB] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: 'Skriv kontraktteksten her...' }),
      MergeField,
      ChoiceField,
      MergeSuggestion.configure({
        onCustomField: (range) => {
          pendingRangeRef.current = { from: range.from, to: range.from }
          setCustomFieldKey('')
          setCustomFieldOpen(true)
        },
        onChoiceField: (range) => {
          pendingRangeRef.current = { from: range.from, to: range.from }
          setChoiceKey('')
          setChoiceOptionA('')
          setChoiceOptionB('')
          setChoiceFieldOpen(true)
        },
      }),
    ],
    content: contentToDoc(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'min-h-[70vh] rounded-md border border-input px-3 py-2 text-sm leading-relaxed focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(docToContent(editor.getJSON()))
    },
  })

  const insertField = (token: string) => {
    if (!editor) return
    editor.chain().focus().insertContent({ type: 'mergeField', attrs: { token } }).run()
  }

  const confirmCustomField = () => {
    const key = customFieldKey.trim()
    if (!editor || !key) return
    const pos = pendingRangeRef.current?.from ?? editor.state.selection.from
    editor.chain().focus().insertContentAt(pos, { type: 'mergeField', attrs: { token: key } }).run()
    setCustomFieldOpen(false)
  }

  const confirmChoiceField = () => {
    const key = choiceKey.trim()
    if (!editor || !key || !choiceOptionA.trim() || !choiceOptionB.trim()) return
    const pos = pendingRangeRef.current?.from ?? editor.state.selection.from
    editor
      .chain()
      .focus()
      .insertContentAt(pos, {
        type: 'choiceField',
        attrs: { key, optionA: choiceOptionA.trim(), optionB: choiceOptionB.trim() },
      })
      .run()
    setChoiceFieldOpen(false)
  }

  if (!editor) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 flex-wrap rounded-md border border-input p-1">
        <Button
          type="button"
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('paragraph') ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8"
          title="Normal tekst"
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="size-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8"
          title="Overskrift 1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="size-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8"
          title="Overskrift 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          type="button"
          variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="size-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
          size="icon"
          className="size-8"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1">
                Sett inn felt
                <ChevronDown className="size-3.5" />
              </Button>
            }
          />
          <DropdownMenuContent>
            <DropdownMenuLabel>Ansattfelter</DropdownMenuLabel>
            {EMPLOYEE_FIELDS.map((token) => (
              <DropdownMenuItem key={token} onClick={() => insertField(token)}>
                {labelForToken(token)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Firmafelter</DropdownMenuLabel>
            {COMPANY_FIELDS.map((token) => (
              <DropdownMenuItem key={token} onClick={() => insertField(token)}>
                {labelForToken(token)}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                pendingRangeRef.current = null
                setCustomFieldKey('')
                setCustomFieldOpen(true)
              }}
            >
              Eget felt...
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                pendingRangeRef.current = null
                setChoiceKey('')
                setChoiceOptionA('')
                setChoiceOptionB('')
                setChoiceFieldOpen(true)
              }}
            >
              Valgfelt (enten/eller)...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <EditorContent editor={editor} />

      <p className="text-xs text-muted-foreground">
        Skriv {'{{'} for å sette inn et felt raskt, eller bruk "Sett inn felt" over.
      </p>

      <Dialog open={customFieldOpen} onOpenChange={setCustomFieldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eget felt</DialogTitle>
            <DialogDescription>
              Feltet fylles ut manuelt av administrator når kontrakten sendes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-field-key">Feltnavn</Label>
            <Input
              id="custom-field-key"
              value={customFieldKey}
              onChange={(e) => setCustomFieldKey(e.target.value)}
              placeholder="f.eks. stillingstittel"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomFieldOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={confirmCustomField} disabled={!customFieldKey.trim()}>
              Sett inn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={choiceFieldOpen} onOpenChange={setChoiceFieldOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valgfelt (enten/eller)</DialogTitle>
            <DialogDescription>
              Administrator velger ett av de to alternativene når kontrakten sendes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="choice-key">Feltnavn</Label>
              <Input
                id="choice-key"
                value={choiceKey}
                onChange={(e) => setChoiceKey(e.target.value)}
                placeholder="f.eks. stillingstype"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="choice-a">Alternativ A</Label>
              <Input
                id="choice-a"
                value={choiceOptionA}
                onChange={(e) => setChoiceOptionA(e.target.value)}
                placeholder="f.eks. Fast ansettelse"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="choice-b">Alternativ B</Label>
              <Input
                id="choice-b"
                value={choiceOptionB}
                onChange={(e) => setChoiceOptionB(e.target.value)}
                placeholder="f.eks. Midlertidig ansettelse"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChoiceFieldOpen(false)}>
              Avbryt
            </Button>
            <Button
              onClick={confirmChoiceField}
              disabled={!choiceKey.trim() || !choiceOptionA.trim() || !choiceOptionB.trim()}
            >
              Sett inn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
