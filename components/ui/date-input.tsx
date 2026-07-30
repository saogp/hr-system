import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { CalendarDays } from "lucide-react"

import { cn } from "@/lib/utils"

const DateInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLInputElement>(null)

    React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement)

    return (
      <div className="relative">
        <InputPrimitive
          ref={innerRef}
          type="date"
          data-slot="input"
          className={cn(
            "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 pr-9 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&::-webkit-calendar-picker-indicator]:opacity-0",
            className
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            const el = innerRef.current
            if (!el) return
            if (typeof el.showPicker === "function") {
              el.showPicker()
            } else {
              el.focus()
            }
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>
    )
  }
)
DateInput.displayName = "DateInput"

export { DateInput }
