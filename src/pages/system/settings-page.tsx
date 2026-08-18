import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import {
  CheckCircle2Icon,
  KeyIcon,
  LoaderCircleIcon,
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
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth"
import { apiRequest, ApiError, getAccessToken } from "@/lib/api/client"
import { changePassword, updateProfile, uploadProfilePhoto } from "@/lib/api/auth"
import { getHealth } from "@/lib/api/agency"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function SettingsPage() {
  const { user, logout, updateUser } = useAuth()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [health, setHealth] = useState<{
    status?: string
    environment?: string
    version?: string
  } | null>(null)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)
  const [name, setName] = useState(user?.name ?? "")
  const [profileState, setProfileState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [profileError, setProfileError] = useState("")
  const [photoState, setPhotoState] = useState<"idle" | "uploading" | "uploaded" | "error">("idle")
  const [photoError, setPhotoError] = useState("")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [passwordError, setPasswordError] = useState("")
  const [agencyState, setAgencyState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [agencyError, setAgencyError] = useState("")
  const [agencyLogoState, setAgencyLogoState] = useState<"idle" | "uploading" | "uploaded" | "error">("idle")
  const [agencyLogoError, setAgencyLogoError] = useState("")
  const [agencyLogoPreview, setAgencyLogoPreview] = useState<string | null>(null)
  const [domain, setDomain] = useState("")
  const [subscriptionPlan, setSubscriptionPlan] = useState("trial")
  const [maxUsers, setMaxUsers] = useState(5)
  const [billingContactEmail, setBillingContactEmail] = useState("")
  const agencyLogoRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(user?.name ?? "")
  }, [user?.name])

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  async function saveProfile() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setProfileState("error")
      setProfileError("Name is required.")
      return
    }
    setProfileState("saving")
    setProfileError("")
    try {
      const response = await updateProfile(trimmedName)
      updateUser(response.data ?? { name: trimmedName })
      setName(response.data?.name ?? trimmedName)
      setProfileState("saved")
    } catch (error) {
      setProfileState("error")
      setProfileError(error instanceof ApiError ? error.message : "Unable to save profile. Try again.")
    }
  }

  async function onPhotoSelected(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setPhotoState("error")
      setPhotoError("Choose an image file.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoState("error")
      setPhotoError("Image must be 5 MB or smaller.")
      return
    }
    const preview = URL.createObjectURL(file)
    setPhotoPreview(preview)
    setPhotoState("uploading")
    setPhotoError("")
    try {
      const form = new FormData()
      form.append("photo", file)
      const response = await uploadProfilePhoto(form)
      if (response.data) updateUser(response.data)
      setPhotoState("uploaded")
    } catch (error) {
      setPhotoState("error")
      setPhotoError(error instanceof ApiError ? error.message : "Unable to upload photo. Try again.")
    } finally {
      if (photoRef.current) photoRef.current.value = ""
    }
  }

  async function savePassword() {
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
      setPasswordState("error")
      setPasswordError(
        !currentPassword ? "Enter your current password." : newPassword.length < 8
          ? "New password must be at least 8 characters."
          : "New passwords do not match.",
      )
      return
    }
    setPasswordState("saving")
    setPasswordError("")
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordState("saved")
    } catch (error) {
      setPasswordState("error")
      setPasswordError(error instanceof ApiError ? error.message : "Unable to change password. Try again.")
    }
  }

  async function saveAgency() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setAgencyState("error")
      setAgencyError("Agency name is required.")
      return
    }
    setAgencyState("saving")
    setAgencyError("")
    try {
      const form = new FormData()
      form.append("name", trimmedName)
      form.append("domain", domain)
      form.append("subscriptionPlan", subscriptionPlan)
      form.append("maxUsers", String(maxUsers))
      form.append("billingContactEmail", billingContactEmail)
      if (agencyLogoPreview) {
        form.append("avatarUrl", agencyLogoPreview)
      }
      const response = await apiRequest<{
        success: boolean
        data: any
        message?: string
      }>("/api/v1/auth/agency", {
        method: "PUT",
        body: form,
      })
      setAgencyState("saved")
    } catch (error) {
      setAgencyState("error")
      setAgencyError(error instanceof ApiError ? error.message : "Unable to update agency. Try again.")
    }
  }

  async function onAgencyLogoSelected(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setAgencyLogoState("error")
      setAgencyLogoError("Choose an image file.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAgencyLogoState("error")
      setAgencyLogoError("Logo must be 2 MB or smaller.")
      return
    }
    const preview = URL.createObjectURL(file)
    setAgencyLogoPreview(preview)
    setAgencyLogoState("uploading")
    setAgencyLogoError("")
    try {
      const form = new FormData()
      form.append("agencyLogo", file)
      form.append("name", name)
      form.append("domain", domain)
      form.append("subscriptionPlan", subscriptionPlan)
      form.append("maxUsers", String(maxUsers))
      form.append("billingContactEmail", billingContactEmail)
      const response = await apiRequest<{
        success: boolean
        data: any
        message?: string
      }>("/api/v1/auth/agency", {
        method: "PUT",
        body: form,
      })
      if (response.data) {
        // Agency update handles the avatarUrl
      }
      setAgencyLogoState("uploaded")
    } catch (error) {
      setAgencyLogoState("error")
      setAgencyLogoError(error instanceof ApiError ? error.message : "Unable to upload logo. Try again.")
    } finally {
      if (agencyLogoRef.current) agencyLogoRef.current.value = ""
    }
  }

  const photoUrl = photoPreview ?? user?.photoUrl ?? user?.avatarUrl
  const initials = (user?.name || user?.email || "?").slice(0, 1).toUpperCase()
  const busy = profileState === "saving" || photoState === "uploading" || passwordState === "saving"

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
        <div className="mb-5 flex items-center gap-3">
          <Avatar size="lg">
            {photoUrl ? <AvatarImage src={photoUrl} alt="Profile photo" /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => photoRef.current?.click()}>
              {photoState === "uploading" ? "Uploading…" : "Change photo"}
            </Button>
            <input ref={photoRef} className="hidden" type="file" accept="image/*" onChange={(event) => void onPhotoSelected(event.target.files?.[0])} />
            <p className="text-muted-foreground mt-1 text-xs">PNG, JPG, or GIF up to 5 MB.</p>
            {photoState === "uploaded" ? <p className="text-chart-2 text-xs">Photo updated.</p> : null}
            {photoState === "error" ? <p className="text-destructive text-xs">{photoError}</p> : null}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm sm:col-span-2">
            <span className="text-muted-foreground text-xs">Name</span>
            <Input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} disabled={busy} />
          </label>
          <div className="text-sm">
            <span className="text-muted-foreground text-xs">Email</span>
            <p className="font-medium">{user?.email || "—"}</p>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground text-xs">Role</span>
            <p><Badge variant="secondary" className="capitalize">{user?.role || "—"}</Badge></p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" disabled={busy} onClick={() => void saveProfile()}>
            {profileState === "saving" ? <LoaderCircleIcon className="animate-spin" /> : null} Save profile
          </Button>
          {profileState === "saved" ? <span className="text-chart-2 text-sm">Profile saved.</span> : null}
          {profileState === "error" ? <span className="text-destructive text-sm">{profileError}</span> : null}
        </div>
        <Separator className="my-4" />
        <div className="grid gap-3">
          <h3 className="text-sm font-medium">Change password</h3>
          <Input type="password" placeholder="Current password" autoComplete="current-password" value={currentPassword} disabled={busy} onChange={(event) => setCurrentPassword(event.target.value)} />
          <Input type="password" placeholder="New password (8+ characters)" autoComplete="new-password" value={newPassword} disabled={busy} onChange={(event) => setNewPassword(event.target.value)} />
          <Input type="password" placeholder="Confirm new password" autoComplete="new-password" value={confirmPassword} disabled={busy} onChange={(event) => setConfirmPassword(event.target.value)} />
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void savePassword()}>
              {passwordState === "saving" ? <LoaderCircleIcon className="animate-spin" /> : null} Update password
            </Button>
            {passwordState === "saved" ? <span className="text-chart-2 text-sm">Password changed.</span> : null}
            {passwordState === "error" ? <span className="text-destructive text-sm">{passwordError}</span> : null}
          </div>
        </div>
        <Separator className="my-4" />
        {/* Agency Settings (admin only) */}
        {user?.role === "admin" && (
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <ServerIcon className="size-4" />
              <h2 className="font-semibold">Agency Settings</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span className="text-muted-foreground text-xs">Name</span>
                <Input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} disabled={busy} />
              </label>
              <div className="text-sm">
                <span className="text-muted-foreground text-xs">Domain</span>
                <Input value={domain} maxLength={50} onChange={(event) => setDomain(event.target.value)} disabled={busy} />
              </div>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span className="text-muted-foreground text-xs">Subscription Plan</span>
                <select
                  value={subscriptionPlan}
                  onChange={(event) => setSubscriptionPlan(event.target.value)}
                  disabled={busy}
                >
                  <option value="trial">Trial</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span className="text-muted-foreground text-xs">Max Users</span>
                <input
                  type="number"
                  value={maxUsers}
                  onChange={(event) => setMaxUsers(Number(event.target.value))}
                  min="1"
                  disabled={busy}
                />
              </label>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span className="text-muted-foreground text-xs">Billing Contact Email</span>
                <Input
                  value={billingContactEmail}
                  onChange={(event) => setBillingContactEmail(event.target.value)}
                  disabled={busy}
                  type="email"
                />
              </label>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <span className="text-muted-foreground text-xs">Agency Logo</span>
                <Input
                  accept="image/*"
                  type="file"
                  className="hidden"
                  ref={agencyLogoRef}
                  onChange={(event) => void onAgencyLogoSelected(event.target.files?.[0])}
                />
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => agencyLogoRef.current?.click()}>
                  {agencyLogoState === "uploading" ? "Uploading…" : "Change logo"}
                </Button>
              </label>
              {agencyLogoState === "uploaded" ? <p className="text-chart-2 text-xs">Logo updated.</p> : null}
              {agencyLogoState === "error" ? <p className="text-destructive text-xs">{agencyLogoError}</p> : null}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button type="button" disabled={busy} onClick={() => void saveAgency()}>
                {agencyState === "saving" ? <LoaderCircleIcon className="animate-spin" /> : null} Save agency
              </Button>
              {agencyState === "saved" ? <span className="text-chart-2 text-sm">Agency saved.</span> : null}
              {agencyState === "error" ? <span className="text-destructive text-sm">{agencyError}</span> : null}
            </div>
          </Card>
        )}
        <Separator className="my-4" />
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
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
