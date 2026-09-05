import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import {
  Building2Icon,
  CheckCircle2Icon,
  KeyIcon,
  LayersIcon,
  LoaderCircleIcon,
  MoonIcon,
  PaletteIcon,
  ServerIcon,
  ShieldIcon,
  SunIcon,
  UploadIcon,
  UserIcon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/lib/auth"
import { apiRequest, ApiError, getAccessToken } from "@/lib/api/client"
import { changePassword, updateProfile, uploadProfilePhoto } from "@/lib/api/auth"
import { getHealth } from "@/lib/api/agency"
import { cn } from "@/lib/utils"

type TabType = "account" | "agency" | "security" | "appearance" | "system"

export function SettingsPage() {
  const { user, updateUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<TabType>("account")

  // Health state
  const [health, setHealth] = useState<{
    status?: string
    environment?: string
    version?: string
  } | null>(null)
  const [healthOk, setHealthOk] = useState<boolean | null>(null)

  // Profile state
  const [name, setName] = useState(user?.name ?? "")
  const [profileState, setProfileState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [profileError, setProfileError] = useState("")
  const [photoState, setPhotoState] = useState<"idle" | "uploading" | "uploaded" | "error">("idle")
  const [photoError, setPhotoError] = useState("")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  // Password state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordState, setPasswordState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [passwordError, setPasswordError] = useState("")

  // Agency state
  const [agencyData, setAgencyData] = useState<any>(null)
  const [agencyLoading, setAgencyLoading] = useState(true)
  const [agencyName, setAgencyName] = useState("")
  const [agencySlug, setAgencySlug] = useState("")
  const [domain, setDomain] = useState("")
  const [subscriptionPlan, setSubscriptionPlan] = useState("trial")
  const [maxUsers, setMaxUsers] = useState(5)
  const [billingContactEmail, setBillingContactEmail] = useState("")
  const [agencyState, setAgencyState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [agencyError, setAgencyError] = useState("")
  const [agencyLogoState, setAgencyLogoState] = useState<"idle" | "uploading" | "uploaded" | "error">("idle")
  const [agencyLogoError, setAgencyLogoError] = useState("")
  const [agencyLogoPreview, setAgencyLogoPreview] = useState<string | null>(null)
  const agencyLogoRef = useRef<HTMLInputElement>(null)

  // Sync user name
  useEffect(() => {
    setName(user?.name ?? "")
  }, [user?.name])

  // Cleanup object URLs
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    if (agencyLogoPreview) URL.revokeObjectURL(agencyLogoPreview)
  }, [photoPreview, agencyLogoPreview])

  // Load agency details on mount
  useEffect(() => {
    let cancelled = false
    async function loadAgency() {
      setAgencyLoading(true)
      try {
        const res = await apiRequest<{ success: boolean; data: any }>("/api/v1/auth/agency")
        if (!cancelled && res.data) {
          setAgencyData(res.data)
          setAgencyName(res.data.name || "")
          setAgencySlug(res.data.slug || "")
          setDomain(res.data.domain || "")
          setSubscriptionPlan(res.data.subscriptionPlan || "pro")
          setMaxUsers(res.data.seats || res.data.maxUsers || 5)
          setBillingContactEmail(res.data.billingContactEmail || res.data.billingEmail || "")
          if (res.data.logoUrl || res.data.avatarUrl) {
            setAgencyLogoPreview(res.data.logoUrl || res.data.avatarUrl)
          }
        }
      } catch (err) {
        console.warn("Could not load agency settings:", err)
      } finally {
        if (!cancelled) setAgencyLoading(false)
      }
    }
    void loadAgency()
    return () => {
      cancelled = true
    }
  }, [])

  // Health ping
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
      toast.success("Profile updated successfully")
    } catch (error) {
      setProfileState("error")
      setProfileError(error instanceof ApiError ? error.message : "Unable to save profile.")
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
      toast.success("Profile photo updated")
    } catch (error) {
      setPhotoState("error")
      setPhotoError(error instanceof ApiError ? error.message : "Unable to upload photo.")
    } finally {
      if (photoRef.current) photoRef.current.value = ""
    }
  }

  async function savePassword() {
    if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
      setPasswordState("error")
      setPasswordError(
        !currentPassword
          ? "Enter your current password."
          : newPassword.length < 8
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
      toast.success("Password changed successfully")
    } catch (error) {
      setPasswordState("error")
      setPasswordError(error instanceof ApiError ? error.message : "Unable to change password.")
    }
  }

  async function saveAgency() {
    const trimmedName = agencyName.trim()
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
      form.append("domain", domain.trim())
      form.append("subscriptionPlan", subscriptionPlan)
      form.append("maxUsers", String(maxUsers))
      form.append("billingContactEmail", billingContactEmail.trim())

      const response = await apiRequest<{
        success: boolean
        data: any
        message?: string
      }>("/api/v1/auth/agency", {
        method: "PUT",
        body: form,
      })
      if (response.data) {
        setAgencyData(response.data)
      }
      setAgencyState("saved")
      toast.success("Agency settings updated")
    } catch (error) {
      setAgencyState("error")
      setAgencyError(error instanceof ApiError ? error.message : "Unable to update agency settings.")
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
      form.append("name", agencyName)
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
        setAgencyData(response.data)
      }
      setAgencyLogoState("uploaded")
      toast.success("Agency logo uploaded")
    } catch (error) {
      setAgencyLogoState("error")
      setAgencyLogoError(error instanceof ApiError ? error.message : "Unable to upload logo.")
    } finally {
      if (agencyLogoRef.current) agencyLogoRef.current.value = ""
    }
  }

  const photoUrl = photoPreview ?? user?.photoUrl ?? user?.avatarUrl
  const initials = (user?.name || user?.email || "?").slice(0, 1).toUpperCase()
  const isAdmin = user?.role === "admin" || user?.role === "agency_admin"
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") || "(Vite Proxy → /api/v1)"

  const navItems: { id: TabType; label: string; icon: typeof UserIcon }[] = [
    { id: "account", label: "Account Profile", icon: UserIcon },
    { id: "agency", label: "Agency & Workspace", icon: Building2Icon },
    { id: "security", label: "Security & Passwords", icon: KeyIcon },
    { id: "appearance", label: "Theme & Display", icon: PaletteIcon },
    { id: "system", label: "System & Health", icon: ServerIcon },
  ]

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings & Workspace</h1>
          <p className="text-muted-foreground text-sm">
            Manage your personal profile, agency configuration, security, and preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {agencyData ? (
            <Badge variant="outline" className="gap-1.5 px-3 py-1 font-mono text-xs capitalize">
              <Building2Icon className="size-3 text-primary" />
              {agencyData.name || user?.agencySlug}
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex gap-1 overflow-x-auto border-b pb-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Tab 1: Account Profile */}
      {activeTab === "account" && (
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex items-center gap-2.5">
            <UserIcon className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold text-base">Personal Profile</h2>
              <p className="text-muted-foreground text-xs">Your identity across team workspaces and notifications.</p>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="size-16 ring-2 ring-primary/20">
              {photoUrl ? <AvatarImage src={photoUrl} alt="Profile photo" /> : null}
              <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={photoState === "uploading"}
                  onClick={() => photoRef.current?.click()}
                >
                  <UploadIcon className="size-3.5" />
                  {photoState === "uploading" ? "Uploading…" : "Upload Avatar"}
                </Button>
                <input
                  ref={photoRef}
                  className="hidden"
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onPhotoSelected(e.target.files?.[0])}
                />
              </div>
              <p className="text-muted-foreground mt-1 text-xs">PNG, JPG, or WebP up to 5 MB.</p>
              {photoState === "error" ? <p className="text-destructive mt-1 text-xs">{photoError}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="account-name">Display Name *</Label>
              <Input
                id="account-name"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                disabled={profileState === "saving"}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Email Address</Label>
              <Input value={user?.email || "—"} disabled className="bg-muted/50 font-mono" />
            </div>

            <div className="grid gap-1.5">
              <Label>Assigned Role</Label>
              <div className="flex h-9 items-center">
                <Badge variant="secondary" className="gap-1 capitalize font-medium">
                  <ShieldIcon className="size-3" />
                  {user?.role || "Member"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              disabled={profileState === "saving" || !name.trim()}
              onClick={() => void saveProfile()}
            >
              {profileState === "saving" ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
              Save Profile Changes
            </Button>
            {profileError ? <p className="text-destructive text-xs">{profileError}</p> : null}
          </div>
        </Card>
      )}

      {/* Tab 2: Agency & Workspace */}
      {activeTab === "agency" && (
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Building2Icon className="size-5 text-primary" />
              <div>
                <h2 className="font-semibold text-base">Agency & Organization</h2>
                <p className="text-muted-foreground text-xs">Workspace branding, seat allocations, and billing contact.</p>
              </div>
            </div>
            <Badge variant="default" className="capitalize">
              {subscriptionPlan} Tier
            </Badge>
          </div>

          <Separator />

          {/* Logo Upload */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex size-16 items-center justify-center rounded-xl border bg-muted/30 p-1">
              {agencyLogoPreview ? (
                <img
                  src={agencyLogoPreview}
                  alt="Agency logo"
                  className="size-full rounded-lg object-contain"
                />
              ) : (
                <Building2Icon className="size-8 text-muted-foreground/50" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!isAdmin || agencyLogoState === "uploading"}
                  onClick={() => agencyLogoRef.current?.click()}
                >
                  <UploadIcon className="size-3.5" />
                  {agencyLogoState === "uploading" ? "Uploading…" : "Change Logo"}
                </Button>
                <input
                  ref={agencyLogoRef}
                  className="hidden"
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onAgencyLogoSelected(e.target.files?.[0])}
                />
              </div>
              <p className="text-muted-foreground mt-1 text-xs">PNG, SVG, or JPG up to 2 MB.</p>
              {agencyLogoError ? <p className="text-destructive mt-1 text-xs">{agencyLogoError}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="agency-name">Agency Legal Name *</Label>
              <Input
                id="agency-name"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                disabled={!isAdmin || agencyState === "saving"}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="agency-slug">Workspace Identifier (Slug)</Label>
              <Input
                id="agency-slug"
                value={agencySlug}
                disabled
                className="bg-muted/50 font-mono"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="agency-domain">Custom Domain / Subdomain</Label>
              <Input
                id="agency-domain"
                placeholder="acme.cosmos.app"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                disabled={!isAdmin || agencyState === "saving"}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="billing-email">Billing Contact Email</Label>
              <Input
                id="billing-email"
                type="email"
                placeholder="billing@agency.com"
                value={billingContactEmail}
                onChange={(e) => setBillingContactEmail(e.target.value)}
                disabled={!isAdmin || agencyState === "saving"}
              />
            </div>
          </div>

          {/* Seat Quota Box */}
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UsersIcon className="size-4 text-primary" />
                <span className="text-xs font-semibold">Seat Utilization</span>
              </div>
              <span className="font-mono text-xs font-medium">
                {agencyData?.seatsUsed ?? 1} / {maxUsers} seats used
              </span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.round(((agencyData?.seatsUsed ?? 1) / Math.max(1, maxUsers)) * 100))}%`,
                }}
              />
            </div>
          </div>

          {isAdmin ? (
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                disabled={agencyState === "saving" || !agencyName.trim()}
                onClick={() => void saveAgency()}
              >
                {agencyState === "saving" ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
                Save Agency Settings
              </Button>
              {agencyError ? <p className="text-destructive text-xs">{agencyError}</p> : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Only workspace administrators can modify organization properties.
            </p>
          )}
        </Card>
      )}

      {/* Tab 3: Security & Passwords */}
      {activeTab === "security" && (
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex items-center gap-2.5">
            <KeyIcon className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold text-base">Security & Authentication</h2>
              <p className="text-muted-foreground text-xs">Update your account password and security credentials.</p>
            </div>
          </div>

          <Separator />

          <div className="grid max-w-md gap-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="current-pass">Current Password</Label>
              <Input
                id="current-pass"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={passwordState === "saving"}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="new-pass">New Password (8+ characters)</Label>
              <Input
                id="new-pass"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={passwordState === "saving"}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="confirm-pass">Confirm New Password</Label>
              <Input
                id="confirm-pass"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={passwordState === "saving"}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              disabled={passwordState === "saving" || !currentPassword || !newPassword}
              onClick={() => void savePassword()}
            >
              {passwordState === "saving" ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
              Update Password
            </Button>
            {passwordError ? <p className="text-destructive text-xs">{passwordError}</p> : null}
          </div>
        </Card>
      )}

      {/* Tab 4: Theme & Display */}
      {activeTab === "appearance" && (
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex items-center gap-2.5">
            <PaletteIcon className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold text-base">Interface Appearance</h2>
              <p className="text-muted-foreground text-xs">Customize the color scheme and visual theme of Cosmos OS.</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "flex flex-col items-center gap-2.5 rounded-xl border p-4 text-center transition-all",
                theme === "dark"
                  ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/20"
                  : "border-border hover:bg-muted",
              )}
            >
              <MoonIcon className="size-6" />
              <div>
                <div className="text-xs font-semibold">Dark Mode</div>
                <div className="text-muted-foreground text-[10px]">High contrast studio palette</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "flex flex-col items-center gap-2.5 rounded-xl border p-4 text-center transition-all",
                theme === "light"
                  ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/20"
                  : "border-border hover:bg-muted",
              )}
            >
              <SunIcon className="size-6" />
              <div>
                <div className="text-xs font-semibold">Light Mode</div>
                <div className="text-muted-foreground text-[10px]">Clean daylight clarity</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setTheme("system")}
              className={cn(
                "flex flex-col items-center gap-2.5 rounded-xl border p-4 text-center transition-all",
                theme === "system"
                  ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/20"
                  : "border-border hover:bg-muted",
              )}
            >
              <LayersIcon className="size-6" />
              <div>
                <div className="text-xs font-semibold">System Sync</div>
                <div className="text-muted-foreground text-[10px]">Follows OS configuration</div>
              </div>
            </button>
          </div>
        </Card>
      )}

      {/* Tab 5: System & Health */}
      {activeTab === "system" && (
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex items-center gap-2.5">
            <ServerIcon className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold text-base">System Connectivity & Health</h2>
              <p className="text-muted-foreground text-xs">Middleware service status and connected backend metadata.</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border p-3.5">
              <div className="flex items-center gap-2.5">
                {healthOk ? (
                  <CheckCircle2Icon className="size-5 text-emerald-500" />
                ) : (
                  <XCircleIcon className="size-5 text-destructive" />
                )}
                <div>
                  <div className="text-xs font-semibold">Core Middleware API</div>
                  <div className="text-muted-foreground text-[10px]">{apiBase}</div>
                </div>
              </div>
              <Badge variant={healthOk ? "default" : "destructive"} className="text-[10px] uppercase">
                {health?.status || (healthOk ? "Online" : "Disconnected")}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3.5">
              <div className="flex items-center gap-2.5">
                <CheckCircle2Icon className="size-5 text-emerald-500" />
                <div>
                  <div className="text-xs font-semibold">PostgreSQL Multi-Tenancy</div>
                  <div className="text-muted-foreground text-[10px]">Prisma Engine Active</div>
                </div>
              </div>
              <Badge variant="default" className="text-[10px] uppercase">
                Isolated
              </Badge>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
