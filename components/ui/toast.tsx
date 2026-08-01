"use client"

import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import { X, CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitive.Provider
const useToastManager = ToastPrimitive.useToastManager

function Toaster() {
  const { toasts } = useToastManager()

  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport className="fixed inset-x-4 bottom-4 z-[100] flex flex-col gap-2 outline-none sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-full sm:max-w-sm">
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            toast={toast}
            className={cn(
              "relative flex items-start gap-2 rounded-xl bg-popover/75 backdrop-blur-md p-4 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
              "transition-all data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0",
              "data-[ending-style]:opacity-0"
            )}
          >
            <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-green-600" />
            <div className="min-w-0 flex-1">
              <ToastPrimitive.Title className="text-sm font-medium text-brand-navy dark:text-white" />
              <ToastPrimitive.Description className="text-xs text-muted-foreground" />
            </div>
            <ToastPrimitive.Close className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  )
}

export { ToastProvider, Toaster, useToastManager }
