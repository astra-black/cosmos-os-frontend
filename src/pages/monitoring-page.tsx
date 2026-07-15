import { useEffect, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getHealth, getMonitoringStats, normalizeMonitoringStats } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { MonitoringStats } from "@/types/agency"

export function MonitoringPage() {
  const [stats, setStats] = useState<MonitoringStats | null>(null)
  const [healthStatus, setHealthStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [statsRes, healthRes] = await Promise.all([
          getMonitoringStats().catch(() => null),
          getHealth().catch(() => null),
        ])
        if (cancelled) return
        setStats(statsRes ? normalizeMonitoringStats(statsRes) : null)
        setHealthStatus(healthRes?.status ?? null)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load monitoring")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Monitoring</h1>
        <p className="text-muted-foreground text-sm">
          Middleware health and ownership integrity alerts
        </p>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>API health</CardTitle>
              <CardDescription>`GET /health`</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold capitalize">
              {healthStatus ?? "unknown"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Active alerts</CardTitle>
              <CardDescription>`GET /api/v1/agency/monitoring/stats`</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {stats?.activeAlerts ?? "—"}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Critical alerts</CardTitle>
              <CardDescription>Severity breakdown</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {stats?.criticalAlerts ?? "—"}
            </CardContent>
          </Card>
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle>Alert totals</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-4">
              <div>
                Total: <span className="text-foreground font-medium">{stats?.totalAlerts ?? "—"}</span>
              </div>
              <div>
                High: <span className="text-foreground font-medium">{stats?.highAlerts ?? "—"}</span>
              </div>
              <div>
                Medium:{" "}
                <span className="text-foreground font-medium">{stats?.mediumAlerts ?? "—"}</span>
              </div>
              <div>
                Low: <span className="text-foreground font-medium">{stats?.lowAlerts ?? "—"}</span>
              </div>
              <div className="sm:col-span-4">
                Monitoring enabled:{" "}
                <span className="text-foreground font-medium">
                  {stats ? String(stats.enabled) : "—"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
