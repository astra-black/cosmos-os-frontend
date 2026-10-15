import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-all select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // Default — primary tint
        default:     "border-transparent bg-primary/15 text-primary",
        secondary:   "border-border bg-muted text-muted-foreground",
        destructive: "border-destructive/20 bg-destructive/15 text-destructive",
        outline:     "border-border text-foreground bg-transparent",
        ghost:       "border-transparent hover:bg-muted text-muted-foreground",
        link:        "border-transparent text-primary underline-offset-4 hover:underline p-0 h-auto",
        // ── Neon Studio Status Pill System ──────────────────
        // Green — Approved, Paid, Done, Completed, Won
        success:  "border-success/20 bg-success/15 text-success",
        // Amber — Pending, In Review, At Risk, Negotiation
        warning:  "border-warning/20 bg-warning/15 text-warning",
        // Red — Rejected, Overdue, Lost, Over Budget
        danger:   "border-destructive/20 bg-destructive/15 text-destructive",
        // Purple — active states, primary categories
        purple:   "border-primary/20 bg-primary/15 text-primary",
        // Blue — info, other categories
        blue:     "border-ns-blue/20 bg-ns-blue/15 text-ns-blue",
        // Pink — accent categories
        pink:     "border-ns-pink/20 bg-ns-pink/15 text-ns-pink",
        // Orange — accent, star ratings
        orange:   "border-ns-orange/20 bg-ns-orange/15 text-ns-orange",
        // Gray — neutral or unknown
        gray:     "border-border bg-muted text-muted-foreground",
        // On-dark header pills — pastel purple #7a5cc2 with white text
        pastel:   "border-transparent bg-[#7a5cc2] text-white",
        // Live pulsing — events and real-time indicators
        live:     "border-destructive/30 bg-destructive/20 text-destructive animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
