import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { SignInPage } from "@/components/ui/sign-in"
import { portalLogin } from "@/lib/api/platform"
import { ApiError } from "@/lib/api/client"

const PORTAL_KEY = "cosmos.portalUser"

export function getPortalUser() {
  try {
    const raw = localStorage.getItem(PORTAL_KEY)
    const user = raw ? JSON.parse(raw) : null
    if (
      !user ||
      user.role !== "client" ||
      typeof user.clientId !== "string" ||
      typeof user.name !== "string"
    ) {
      clearPortalUser()
      return null
    }
    return user
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
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (existing) return <Navigate to="/portal" replace />

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    const formData = new FormData(event.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

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
    <SignInPage
      title="Client Portal"
      description="External gateway for approvals and shared assets"
      heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
      onSignIn={handleSignIn}
      onGoogleSignIn={() => {}}
      onResetPassword={() => {}}
      error={error}
      pending={pending}
    />
  )
}
