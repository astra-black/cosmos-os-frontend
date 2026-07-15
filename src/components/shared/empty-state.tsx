import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export function EmptyState({
  icon,
  title,
  description,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center",
        className,
      )}
    >
      {icon}
      <p className="text-foreground text-sm font-medium">{title}</p>
      {description ? <p className="max-w-sm text-xs">{description}</p> : null}
    </div>
  )
}
