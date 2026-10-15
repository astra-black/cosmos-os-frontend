import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type EntityFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  onSubmit: () => void | Promise<void>
  submitLabel?: string
  pending?: boolean
  submitDisabled?: boolean
  maxWidth?: string
}

/** Shared right-side drawer shell; each page owns its fields, validation, and mutation. */
export function EntityFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Save",
  pending = false,
  submitDisabled = false,
  maxWidth = "sm:max-w-xl",
}: EntityFormDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full sm:max-w-xl p-0 flex flex-col h-full bg-card border-l border-border shadow-2xl",
          maxWidth
        )}
      >
        <form
          className="flex flex-col h-full overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault()
            void onSubmit()
          }}
        >
          <SheetHeader className="p-6 border-b border-border bg-card shrink-0 pr-12">
            <SheetTitle className="font-sora text-lg font-bold text-foreground">{title}</SheetTitle>
            {description ? (
              <SheetDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {description}
              </SheetDescription>
            ) : null}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">{children}</div>
          <SheetFooter className="p-4 border-t border-border bg-surface-alt/40 flex flex-row items-center justify-end gap-2 shrink-0">
            <SheetClose render={<Button type="button" variant="outline" disabled={pending} />}>
              Cancel
            </SheetClose>
            <Button type="submit" disabled={pending || submitDisabled} aria-busy={pending}>
              {pending ? "Saving..." : submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
