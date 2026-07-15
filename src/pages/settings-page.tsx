import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import {
  CheckCircle2Icon,
  KeyIcon,
  MoonIcon,
  ServerIcon,
  SunIcon,
  UserIcon,
  XCircleIcon,
} from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth"
import { getHealth } from "@/lib/api/agency"
import { getAccessToken } from "@/lib/api/client"

export function SettingsPage() {
  const { user, logout } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [health, setHealth] = useState<{
    status?: string
    environment?: string
    version?: string
  } | null>(null)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)

  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
    "(Vite proxy → localhost:3000)"
  const apiKeyConfigured = Boolean(import.meta.env.VITE_COSMOS_API_KEY)
  const hasToken = Boolean(getAccessToken())

  useEffect(() => {
    let cancelled = false
    async function ping() {
      try {
        const res = await getHealth()
        if (!cancelled) {
          setHealth(res)
          setHealthOk(res.status === "ok" || res.status === "healthy")
        }
      } catch {
        if (!cancelled) {
          setHealth(null)
          setHealthOk(false)
        }
      }
    }
    void ping()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Session, theme, and middleware connection for Cosmos OS.
        </p>
      </div>

      {/* Account */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserIcon className="size-4" />
          <h2 className="font-semibold">Account</h2>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground text-xs">Name</dt>
            <dd className="font-medium">{user?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Email</dt>
            <dd className="font-medium">{user?.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Role</dt>
            <dd>
              <Badge variant="secondary" className="capitalize">
                {user?.role || "—"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Session</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              {hasToken ? (
                <>
                  <CheckCircle2Icon className="size-3.5 text-chart-2" /> Signed in (JWT)
                </>
              ) : (
                <>
                  <XCircleIcon className="text-destructive size-3.5" /> No token
                </>
              )}
            </dd>
          </div>
        </dl>
        <Separator className="my-4" />
        <Button variant="outline" onClick={logout}>
          Sign out
        </Button>
      </Card>

      {/* Appearance */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {resolvedTheme === "dark" ? (
              <MoonIcon className="size-4" />
            ) : (
              <SunIcon className="size-4" />
            )}
            <h2 className="font-semibold">Appearance</h2>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["light", "dark", "system"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={theme === value ? "default" : "outline"}
              className="capitalize"
              onClick={() => setTheme(value)}
            >
              {value}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Preference is stored in localStorage and applies across the shell.
        </p>
      </Card>

      {/* Connection */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <ServerIcon className="size-4" />
          <h2 className="font-semibold">Middleware connection</h2>
        </div>
        <dl className="grid gap-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-muted-foreground">API health</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              {healthOk === null ? (
                "Checking…"
              ) : healthOk ? (
                <>
                  <CheckCircle2Icon className="size-3.5 text-chart-2" />
                  {health?.status ?? "ok"}
                  {health?.version ? ` · v${health.version}` : ""}
                </>
              ) : (
                <>
                  <XCircleIcon className="text-destructive size-3.5" /> Unreachable
                </>
              )}
            </dd>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <dt className="text-muted-foreground">Base URL</dt>
            <dd className="font-mono text-xs break-all">{apiBase}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <dt className="text-muted-foreground flex items-center gap-1">
              <KeyIcon className="size-3.5" /> Cosmos API key
            </dt>
            <dd>
              {apiKeyConfigured ? (
                <Badge variant="secondary">Configured in env</Badge>
              ) : (
                <Badge variant="outline">Missing VITE_COSMOS_API_KEY</Badge>
              )}
            </dd>
          </div>
          {health?.environment ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-muted-foreground">Environment</dt>
              <dd className="capitalize">{health.environment}</dd>
            </div>
          ) : null}
        </dl>
        <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
          Assets and portfolio require both a valid JWT (login) and{" "}
          <code className="bg-muted rounded px-1">x-cosmos-api-key</code> from{" "}
          <code className="bg-muted rounded px-1">VITE_COSMOS_API_KEY</code>, matching{" "}
          <code className="bg-muted rounded px-1">COSMOS_API_KEYS</code> on the middleware.
        </p>
      </Card>
    </div>
  )
}
