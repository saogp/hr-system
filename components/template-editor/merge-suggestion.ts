import { Extension } from '@tiptap/core'
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import { SuggestionList, type SuggestionItem, type SuggestionListRef } from './suggestion-list'
import { EMPLOYEE_FIELDS, COMPANY_FIELDS, labelForToken } from '@/lib/template-doc'

export type MergeSuggestionOptions = {
  onCustomField: (range: { from: number; to: number }) => void
  onChoiceField: (range: { from: number; to: number }) => void
}

function buildItems(query: string): SuggestionItem[] {
  const fieldItems: SuggestionItem[] = [...EMPLOYEE_FIELDS, ...COMPANY_FIELDS].map((token) => ({
    kind: 'field' as const,
    token,
    label: labelForToken(token),
  }))
  const actionItems: SuggestionItem[] = [
    { kind: 'custom', label: 'Eget felt...' },
    { kind: 'choice', label: 'Valgfelt (enten/eller)...' },
  ]
  const all = [...fieldItems, ...actionItems]
  const q = query.trim().toLowerCase()
  if (!q) return all
  return all.filter((item) => item.label.toLowerCase().includes(q))
}

export const MergeSuggestion = Extension.create<MergeSuggestionOptions>({
  name: 'mergeSuggestion',

  addOptions() {
    return {
      onCustomField: () => {},
      onChoiceField: () => {},
    }
  },

  addProseMirrorPlugins() {
    const extensionThis = this

    return [
      Suggestion<SuggestionItem>({
        editor: this.editor,
        char: '{{',
        allowSpaces: false,
        items: ({ query }) => buildItems(query),
        command: ({ editor, range, props: item }) => {
          if (item.kind === 'field') {
            editor
              .chain()
              .focus()
              .insertContentAt(range, { type: 'mergeField', attrs: { token: item.token } })
              .run()
          } else if (item.kind === 'custom') {
            editor.chain().focus().deleteRange(range).run()
            extensionThis.options.onCustomField({ from: range.from, to: range.from })
          } else if (item.kind === 'choice') {
            editor.chain().focus().deleteRange(range).run()
            extensionThis.options.onChoiceField({ from: range.from, to: range.from })
          }
        },
        render: () => {
          let component: ReactRenderer<SuggestionListRef, SuggestionProps<SuggestionItem>> | null = null
          let unmount: (() => void) | null = null

          return {
            onStart: (props) => {
              component = new ReactRenderer(SuggestionList, {
                props,
                editor: props.editor,
              })
              if (!props.clientRect) return
              unmount = props.mount(component!.element as HTMLElement)
            },
            onUpdate(props) {
              component?.updateProps(props)
            },
            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                unmount?.()
                return true
              }
              return component?.ref?.onKeyDown(props) ?? false
            },
            onExit() {
              unmount?.()
              component?.destroy()
            },
          }
        },
      }),
    ]
  },
})
