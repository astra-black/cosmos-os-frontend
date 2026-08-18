import { useEffect, useState } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { canPerform } from "@/lib/rbac"
import { useAuth } from "@/lib/auth"
import {
  getTenant,
  listBillingPlans,
  updateBillingPlan,
  type BillingPlan,
  type Tenant,
} from "@/lib/api/platform"
import { ApiError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

export function BillingPage() {
  const { user } = useAuth()
  const canManage = canPerform(user?.role, "manage_billing")
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [loading, setLoading] = useState(true)

  async function reload() {
    const [t, p] = await Promise.all([getTenant(), listBillingPlans()])
    setTenant(t.data ?? null)
    setPlans(p.data ?? [])
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        await reload()
      } catch {
        if (!cancelled) toast.error("Failed to load billing")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function choose(planId: string) {
    if (!canManage) {
      toast.error("Only admins can change plans")
      return
    }
    try {
      const res = await updateBillingPlan(planId)
      setTenant(res.data ?? null)
      toast.success(`Plan → ${planId}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Update failed")
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Billing & tenant"
        description="Multi-tenant workspace plan, seats, and features."
      />

      {tenant ? (
        <Card className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-muted-foreground text-xs">Workspace</div>
            <div className="font-semibold">{tenant.name}</div>
            <div className="text-muted-foreground font-mono text-[11px]">{tenant.tenantId}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Plan</div>
            <Badge className="mt-1 capitalize">{tenant.plan}</Badge>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Seats</div>
            <div className="font-semibold tabular-nums">
              {tenant.seatsUsed}/{tenant.seats}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Renews</div>
            <div className="font-medium">
              {tenant.renewsAt ? new Date(tenant.renewsAt).toLocaleDateString() : "—"}
            </div>
          </div>
        </Card>
      ) : null}

      {!canManage ? (
        <p className="text-muted-foreground text-sm">
          You can view billing. Only <strong>admin</strong> can change plans.
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((plan) => {
          const current = tenant?.plan === plan.id
          return (
            <Card
              key={plan.id}
              className={cn("flex flex-col gap-3 p-5", current && "border-primary")}
            >
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                {current ? <Badge>Current</Badge> : null}
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                ${plan.priceMonthly}
                <span className="text-muted-foreground text-sm font-normal">/mo</span>
              </div>
              <div className="text-muted-foreground text-sm">{plan.seats} seats</div>
              <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                {plan.features.map((f) => (
                  <li key={f} className="capitalize">
                    · {f.replace("_", " ")}
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant={current ? "outline" : "default"}
                disabled={current || !canManage}
                onClick={() => void choose(plan.id)}
              >
                {current ? "Active" : "Select plan"}
              </Button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
