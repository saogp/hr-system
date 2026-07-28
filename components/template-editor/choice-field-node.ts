import { Node, mergeAttributes } from '@tiptap/core'

export const ChoiceField = Node.create({
  name: 'choiceField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      key: { default: '' },
      optionA: { default: '' },
      optionB: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-choice-field]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-choice-field': node.attrs.key,
        class:
          'inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-xs font-medium align-baseline mx-0.5 select-none',
      }),
      `${node.attrs.key}: ${node.attrs.optionA} / ${node.attrs.optionB}`,
    ]
  },
})
