import { Node, mergeAttributes } from '@tiptap/core'
import { labelForToken } from '@/lib/template-doc'

export const MergeField = Node.create({
  name: 'mergeField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      token: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-merge-field]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-merge-field': node.attrs.token,
        class:
          'inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 text-xs font-medium align-baseline mx-0.5 select-none',
      }),
      labelForToken(node.attrs.token),
    ]
  },
})
