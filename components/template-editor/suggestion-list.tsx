import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'

export type SuggestionItem =
  | { kind: 'field'; token: string; label: string }
  | { kind: 'custom'; label: string }
  | { kind: 'choice'; label: string }

export type SuggestionListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

export const SuggestionList = forwardRef<SuggestionListRef, SuggestionProps<SuggestionItem>>(
  function SuggestionList(props, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)

    useEffect(() => {
      setSelectedIndex(0)
    }, [props.items])

    const selectItem = (index: number) => {
      const item = props.items[index]
      if (item) props.command(item)
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % props.items.length)
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    if (props.items.length === 0) {
      return (
        <div className="rounded-md border border-input bg-popover shadow-md p-2 text-xs text-muted-foreground">
          Ingen felt funnet
        </div>
      )
    }

    return (
      <div className="thin-scrollbar rounded-md border border-input bg-popover shadow-md p-1 min-w-48 max-h-64 overflow-y-auto">
        {props.items.map((item, index) => (
          <button
            type="button"
            key={item.kind === 'field' ? item.token : item.kind}
            className={`flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-left ${
              index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
            }`}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => selectItem(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
    )
  }
)
