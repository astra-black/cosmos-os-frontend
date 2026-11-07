import { ClockIcon, EyeIcon, PlugIcon, RadioIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type DataFreshness = "Live" | "Delayed" | "Disconnected" | "Unverified"

const FRESHNESS_META: Record<
  DataFreshness,
  { icon: typeof RadioIcon; className: string }
> = {
  Live: { icon: RadioIcon, className: "is-live" },
  Delayed: { icon: ClockIcon, className: "is-delayed" },
  Disconnected: { icon: PlugIcon, className: "is-disconnected" },
  Unverified: { icon: EyeIcon, className: "is-unverified" },
}

export const FRESHNESS_LEGEND: { value: DataFreshness; description: string }[] = [
  { value: "Live", description: "Current from its source" },
  { value: "Delayed", description: "Source is behind" },
  { value: "Disconnected", description: "No feed; last known value shown" },
  { value: "Unverified", description: "Imported or entered, not confirmed" },
]

export function DataFreshnessPill({
  value,
  className,
}: {
  value: DataFreshness
  className?: string
}) {
  const meta = FRESHNESS_META[value]
  const Icon = meta.icon
  return (
    <span className={cn("cosmos-freshness-pill", meta.className, className)}>
      <Icon className="size-2.5" aria-hidden />
      {value}
    </span>
  )
}
