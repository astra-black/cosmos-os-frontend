import type { ReactNode } from "react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"

type StatisticsCardProps = {
  icon: ReactNode
  value: string
  title: string
  changePercentage?: string
  periodLabel?: string
  className?: string
}

export function StatisticsCard({
  icon,
  value,
  title,
  changePercentage,
  periodLabel,
  className,
}: StatisticsCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex items-center gap-2">
        <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-sm">
          {icon}
        </div>
        <span className="text-2xl font-bold">{value}</span>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {changePercentage ? (
          <p className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-foreground/80">{changePercentage}</span>
            {periodLabel ? <span className="text-muted-foreground">{periodLabel}</span> : null}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

