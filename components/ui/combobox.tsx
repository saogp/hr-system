"use client"

import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { ChevronDownIcon, CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type ComboboxOption = { value: string; label: string }

// Below this item count a plain Select reads better; at or above it, typing to
// filter is worth the extra interaction. Kept in one place so every call site
// that needs to decide "select vs. searchable combobox" agrees.
export const COMBOBOX_SEARCH_THRESHOLD = 6

function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Velg...",
  className,
}: {
  options: ComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const items = React.useMemo(() => options, [options])

  return (
    <ComboboxPrimitive.Root
      items={items}
      value={value || null}
      onValueChange={(val) => onValueChange((val as string | null) ?? "")}
    >
      <ComboboxPrimitive.InputGroup
        className={cn(
          "flex h-10 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent pl-2.5 pr-2 text-sm transition-colors outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
          className
        )}
      >
        <ComboboxPrimitive.Input
          placeholder={placeholder}
          className="h-full flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
        />
        <ComboboxPrimitive.Icon className="flex shrink-0 items-center">
          <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
        </ComboboxPrimitive.Icon>
      </ComboboxPrimitive.InputGroup>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          collisionAvoidance={{ side: "flip", align: "shift" }}
          className="isolate z-50 w-(--anchor-width)"
        >
          <ComboboxPrimitive.Popup className="thin-scrollbar max-h-(--available-height) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-[8px] bg-popover/75 backdrop-blur-md p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <ComboboxPrimitive.Empty className="px-2 py-1.5 text-sm text-muted-foreground">
              Ingen treff.
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {(option: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  <ComboboxPrimitive.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                    <CheckIcon className="pointer-events-none size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}

export { Combobox }
