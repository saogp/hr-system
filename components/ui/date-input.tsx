import * as React from "react"
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const MONTHS_NO = [
  "Januar", "Februar", "Mars", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Desember",
]
const WEEKDAYS_NO = ["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"]

function parseDateValue(value: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split("-").map(Number)
  return { year, month: month - 1, day }
}

function formatDateValue(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0")
  const dd = String(day).padStart(2, "0")
  return `${year}-${mm}-${dd}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

// JS getDay(): 0=Sun..6=Sat. Convert to Monday-first: 0=Mon..6=Sun.
function mondayFirstWeekday(year: number, month: number, day: number): number {
  return (new Date(year, month, day).getDay() + 6) % 7
}

type DateInputProps = {
  id?: string
  value: string
  onChange: (e: { target: { value: string } }) => void
  required?: boolean
  className?: string
  placeholder?: string
}

const DateInput = React.forwardRef<HTMLButtonElement, DateInputProps>(
  ({ id, value, onChange, required, className, placeholder = "Velg dato" }, forwardedRef) => {
    const [open, setOpen] = React.useState(false)
    const parsed = parseDateValue(value)
    const [viewYear, setViewYear] = React.useState(parsed?.year ?? new Date().getFullYear())
    const [viewMonth, setViewMonth] = React.useState(parsed?.month ?? new Date().getMonth())

    React.useEffect(() => {
      if (parsed) {
        setViewYear(parsed.year)
        setViewMonth(parsed.month)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

    const label = parsed
      ? `${String(parsed.day).padStart(2, "0")}.${String(parsed.month + 1).padStart(2, "0")}.${parsed.year}`
      : placeholder

    const handleSelectDay = (day: number) => {
      onChange({ target: { value: formatDateValue(viewYear, viewMonth, day) } })
      setOpen(false)
    }

    const goPrevMonth = () => {
      if (viewMonth === 0) {
        setViewMonth(11)
        setViewYear((y) => y - 1)
      } else {
        setViewMonth((m) => m - 1)
      }
    }
    const goNextMonth = () => {
      if (viewMonth === 11) {
        setViewMonth(0)
        setViewYear((y) => y + 1)
      } else {
        setViewMonth((m) => m + 1)
      }
    }

    const totalDays = daysInMonth(viewYear, viewMonth)
    const leadingBlanks = mondayFirstWeekday(viewYear, viewMonth, 1)

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              ref={forwardedRef}
              id={id}
              type="button"
              aria-required={required}
              className={cn(
                "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                className
              )}
            >
              <span className={cn("truncate", !parsed && "text-muted-foreground")}>{label}</span>
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
            </button>
          }
        />
        <PopoverContent
          align="start"
          collisionAvoidance={{ side: "flip", align: "none" }}
          className="w-64"
        >
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={goPrevMonth}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold text-brand-navy dark:text-white">
              {MONTHS_NO[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goNextMonth}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS_NO.map((d) => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1
              const selected = parsed?.year === viewYear && parsed?.month === viewMonth && parsed?.day === day
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    "aspect-square rounded-full text-xs font-medium transition-colors",
                    selected ? "bg-brand-orange text-brand-navy" : "text-foreground hover:bg-muted"
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    )
  }
)
DateInput.displayName = "DateInput"

export { DateInput }
