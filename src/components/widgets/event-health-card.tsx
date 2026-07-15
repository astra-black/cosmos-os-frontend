import { Bar, BarChart } from "recharts"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { type ChartConfig, ChartContainer } from "@/components/ui/chart"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

type EventHealthCardProps = {
  eventName?: string
  updatedLabel?: string
  healthScore?: number
  cueCompletionRate?: number
  openIncidents?: number
  className?: string
  loading?: boolean
}

export function EventHealthCard({
  eventName = "No live event",
  updatedLabel = "Waiting for event data",
  healthScore = 0,
  cueCompletionRate = 0,
  openIncidents = 0,
  className,
  loading,
}: EventHealthCardProps) {
  const cueChartData = [
    { label: "A", value: Math.max(cueCompletionRate, 4) },
    { label: "B", value: Math.max(cueCompletionRate * 0.7, 4) },
    { label: "C", value: Math.max(cueCompletionRate * 0.9, 4) },
    { label: "D", value: Math.max(cueCompletionRate * 0.6, 4) },
    { label: "E", value: Math.max(cueCompletionRate * 0.8, 4) },
  ]

  const incidentChartData = [
    { label: "A", value: Math.max(openIncidents * 12, 8) },
    { label: "B", value: Math.max(openIncidents * 9, 8) },
    { label: "C", value: Math.max(openIncidents * 14, 8) },
    { label: "D", value: Math.max(openIncidents * 7, 8) },
    { label: "E", value: Math.max(openIncidents * 11, 8) },
  ]

  const cueConfig = {
    value: { label: "Cues", color: "var(--primary)" },
  } satisfies ChartConfig

  const incidentConfig = {
    value: {
      label: "Incidents",
      color: "color-mix(in oklab, var(--primary) 10%, transparent)",
    },
  } satisfies ChartConfig

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="flex justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-semibold">Event health</span>
          <span className="text-muted-foreground text-sm">
            {eventName} · {updatedLabel}
          </span>
        </div>
        <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-md text-lg font-semibold">
          {Math.round(healthScore)}
        </div>
      </CardHeader>
      <CardContent>
        <Separator />
      </CardContent>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-1">
          <div className="flex flex-col gap-1">
            <span className="text-xs">Cue completion</span>
            <span className="text-2xl font-semibold">{cueCompletionRate.toFixed(0)}%</span>
          </div>
          <ChartContainer config={cueConfig} className="max-w-18 min-h-13">
            <BarChart accessibilityLayer data={cueChartData} barSize={8}>
              <Bar dataKey="value" fill="var(--color-value)" radius={2} />
            </BarChart>
          </ChartContainer>
        </div>
        <div className="flex items-center justify-between gap-1">
          <div className="flex flex-col gap-1">
            <span className="text-xs">Open incidents</span>
            <span className="text-2xl font-semibold">{openIncidents}</span>
          </div>
          <ChartContainer config={incidentConfig} className="max-w-18 min-h-13">
            <BarChart accessibilityLayer data={incidentChartData} barSize={8}>
              <Bar dataKey="value" fill="var(--color-value)" radius={2} />
            </BarChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}
