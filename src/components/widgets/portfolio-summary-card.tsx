import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

export type PortfolioLineItem = {
  key: string
  label: string
  detail: string
  value: string
  progressPercentage: number
}

type PortfolioSummaryCardProps = {
  title: string
  headlineValue: string
  trend: "up" | "down"
  percentage: number
  comparisonText: string
  items: PortfolioLineItem[]
  className?: string
  loading?: boolean
}

export function PortfolioSummaryCard({
  title,
  headlineValue,
  trend,
  percentage,
  comparisonText,
  items,
  className,
  loading,
}: PortfolioSummaryCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-6">
        <div className="text-lg font-semibold">{title}</div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold">{headlineValue}</span>
            <span className="flex items-center gap-1">
              {trend === "up" ? (
                <ChevronUpIcon className="size-4" />
              ) : (
                <ChevronDownIcon className="size-4" />
              )}
              <span className="text-sm">{percentage}%</span>
            </span>
          </div>
          <span className="text-muted-foreground text-sm">{comparisonText}</span>
        </div>
      </CardContent>
      <CardContent className="flex flex-1 flex-col gap-4">
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar className="size-11 rounded-sm after:rounded-[inherit] after:border-0">
                <AvatarFallback className="bg-primary/10 shrink-0 rounded-sm text-xs">
                  {item.label.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <span className="text-base font-medium">{item.label}</span>
                <span className="text-muted-foreground text-sm">{item.detail}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm">{item.value}</p>
              <Progress
                value={item.progressPercentage}
                className="w-36 **:data-[slot=progress-track]:h-1.5"
              />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">No portfolio lines yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
