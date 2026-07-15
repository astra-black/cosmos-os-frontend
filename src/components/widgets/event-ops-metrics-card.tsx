import { Bar, BarChart, Label, Pie, PieChart } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertTriangleIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  FolderKanbanIcon,
} from "lucide-react"

type Metric = {
  title: string
  value: string
  icon: "events" | "projects" | "incidents" | "cues"
}

type EventOpsMetricsCardProps = {
  className?: string
  loading?: boolean
  planPercentage?: number
  metrics?: Metric[]
  statusSlices?: { status: string; count: number; fill: string }[]
}

const iconMap = {
  events: CalendarDaysIcon,
  projects: FolderKanbanIcon,
  incidents: AlertTriangleIcon,
  cues: ClipboardListIcon,
}

export function EventOpsMetricsCard({
  className,
  loading,
  planPercentage = 0,
  metrics = [],
  statusSlices = [],
}: EventOpsMetricsCardProps) {
  const totalBars = 24
  const filledBars = Math.round((planPercentage * totalBars) / 100)

  const progressChartData = Array.from({ length: totalBars }, (_, index) => ({
    slot: index + 1,
    value: index < filledBars ? 315 : 0.0001,
  }))

  const progressConfig = {
    value: { label: "Progress" },
  } satisfies ChartConfig

  const statusConfig = Object.fromEntries(
    statusSlices.map((slice) => [slice.status, { label: slice.status, color: slice.fill }]),
  ) satisfies ChartConfig

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Operations pulse</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Active / confirmed pipeline</span>
            <span className="text-sm font-medium">{planPercentage}%</span>
          </div>
          <ChartContainer config={progressConfig} className="h-12 w-full">
            <BarChart accessibilityLayer data={progressChartData} barSize={6}>
              <Bar dataKey="value" fill="var(--primary)" radius={2} />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {metrics.map((metric) => {
            const Icon = iconMap[metric.icon]
            return (
              <div key={metric.title} className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-sm">
                  <Icon />
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground text-sm">{metric.title}</span>
                  <span className="text-lg font-semibold">{metric.value}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-6">
          <ChartContainer config={statusConfig} className="mx-auto aspect-square h-40">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={statusSlices}
                dataKey="count"
                nameKey="status"
                innerRadius={45}
                strokeWidth={4}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      const total = statusSlices.reduce((sum, item) => sum + item.count, 0)
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                            {total}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 18}
                            className="fill-muted-foreground text-xs"
                          >
                            events
                          </tspan>
                        </text>
                      )
                    }
                    return null
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="flex flex-1 flex-col gap-2">
            {statusSlices.map((slice) => (
              <div key={slice.status} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: slice.fill }} />
                  <span className="capitalize">{slice.status}</span>
                </div>
                <span className="font-medium">{slice.count}</span>
              </div>
            ))}
            {statusSlices.length === 0 && (
              <p className="text-muted-foreground text-sm">No event status data yet.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
