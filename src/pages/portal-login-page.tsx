import { useState, type FormEvent } from "react"
import { Navigate, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { portalLogin } from "@/lib/api/platform"
import { ApiError } from "@/lib/api/client"

const PORTAL_KEY = "cosmos.portalUser"

export function getPortalUser() {
  try {
    const raw = localStorage.getItem(PORTAL_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearPortalUser() {
  localStorage.removeItem(PORTAL_KEY)
}

export function PortalLoginPage() {
  const navigate = useNavigate()
  const existing = getPortalUser()
  const [email, setEmail] = useState("elena@northstar.capital")
  const [password, setPassword] = useState("client123")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (existing) return <Navigate to="/portal" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await portalLogin(email, password)
      localStorage.setItem(PORTAL_KEY, JSON.stringify(res.data))
      navigate("/portal", { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="bg-muted/40 flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Client portal</CardTitle>
          <CardDescription>
            External login for approvals and shared assets. Demo: elena@northstar.capital /
            client123
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Signing in…" : "Enter portal"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
