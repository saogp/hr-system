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
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 outline-none sm:bottom-6 sm:right-6">
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            toast={toast}
            className={cn(
              "relative flex items-start gap-2 rounded-xl border border-border bg-white dark:bg-brand-cream-dark p-4 shadow-lg",
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
