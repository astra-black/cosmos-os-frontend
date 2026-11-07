/**
 * Hub · Personal Account — Figma 00.05 (`557:6`)
 * Evidence: Computer Use opened group 00.05 · Personal Account (dark/light rows,
 * ~20800×2640); COSMOS_V7 12.4; build_v7_account.py; IDENTITY_ACCESS §9.
 * Child frame IDs not transcribed from zoomed-out canvas — structure from generator
 * + inspected group: Profile, Sign-In & Security, Privacy, Organizations, Preferences.
 *
 * Supported: profile name/title/phone, photo upload, change password, appearance theme,
 * current organization membership read-only. Unavailable: passkeys, SSO, 2FA, recovery
 * codes, sessions, privacy matrix, multi-org, notification channel matrix, delete account.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { Link, useLocation } from "react-router-dom"
import { useTheme } from "next-themes"
import {
  ArrowLeftIcon,
  Building2Icon,
  EyeIcon,
  KeyRoundIcon,
  LockIcon,
  Loader2Icon,
  ShieldIcon,
  SlidersHorizontalIcon,
  UploadIcon,
  UserIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changePassword, updateProfile, uploadProfilePhoto } from "@/lib/api/auth"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { roleLabel } from "@/lib/rbac"
import { cn } from "@/lib/utils"

type AccountSection = "profile" | "security" | "privacy" | "organizations" | "preferences"

const NAV: { id: AccountSection; label: string; to: string; icon: typeof UserIcon; group: string }[] = [
  { id: "profile", label: "Profile", to: "/hub/account", icon: UserIcon, group: "You" },
  {
    id: "security",
    label: "Sign-In & Security",
    to: "/hub/account/security",
    icon: LockIcon,
    group: "You",
  },
  {
    id: "privacy",
    label: "Privacy & Visibility",
    to: "/hub/account/privacy",
    icon: EyeIcon,
    group: "You",
  },
  {
    id: "preferences",
    label: "Preferences",
    to: "/hub/account/preferences",
    icon: SlidersHorizontalIcon,
    group: "You",
  },
  {
    id: "organizations",
    label: "Organizations",
    to: "/hub/account/organizations",
    icon: Building2Icon,
    group: "Memberships",
  },
]

function sectionFromPath(pathname: string): AccountSection {
  if (pathname.includes("/security")) return "security"
  if (pathname.includes("/privacy")) return "privacy"
  if (pathname.includes("/preferences")) return "preferences"
  if (pathname.includes("/organizations")) return "organizations"
  return "profile"
}

function initials(name?: string | null, email?: string | null) {
  const source = (name || email || "CO").trim()
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function AccountShell({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  const location = useLocation()
  const section = sectionFromPath(location.pathname)
  const { user } = useAuth()
  const orgName = user?.agencyName || "Your organization"

  const groups = useMemo(() => {
    const map = new Map<string, typeof NAV>()
    for (const item of NAV) {
      const list = map.get(item.group) || []
      list.push(item)
      map.set(item.group, list)
    }
    return Array.from(map.entries())
  }, [])

  return (
    <div
      className="cosmos-home hub-admin hub-account"
      data-figma="00.05 · Personal Account"
      data-node-id="557:6"
      data-evidence="computer-use-group-inspect"
    >
      <header className="hub-admin-header">
        <div>
          <Link className="hub-admin-back" to="/hub">
            <ArrowLeftIcon /> Hub
          </Link>
          <div className="hub-admin-eyebrow">
            <span />
            {orgName} · Personal Account
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions ? <div className="hub-admin-actions">{actions}</div> : null}
      </header>

      <div className="hub-account-layout">
        <aside className="hub-account-nav" aria-label="Personal account">
          {groups.map(([group, items]) => (
            <div key={group} className="hub-account-nav-group">
              <small>{group}</small>
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    className={cn(section === item.id && "is-active")}
                  >
                    <Icon />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </aside>
        <div className="hub-account-main">{children}</div>
      </div>
    </div>
  )
}

export function HubAccountProfilePage() {
  const { user, updateUser } = useAuth()
  const [name, setName] = useState(user?.name || "")
  const [title, setTitle] = useState(user?.title || "")
  const [phone, setPhone] = useState(user?.phone || "")
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoState, setPhotoState] = useState<"idle" | "uploading" | "error">("idle")
  const [photoError, setPhotoError] = useState<string | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const photoUrl = user?.avatarUrl || user?.photoUrl || null

  useEffect(() => {
    setName(user?.name || "")
    setTitle(user?.title || "")
    setPhone(user?.phone || "")
    setDirty(false)
  }, [user?.name, user?.title, user?.phone])

  async function saveProfile() {
    if (!name.trim()) {
      toast.error("Full name is required")
      return
    }
    setSaving(true)
    try {
      const res = await updateProfile({
        name: name.trim(),
        title: title.trim() || null,
        phone: phone.trim() || null,
      })
      updateUser({
        ...(res.data || {}),
        name: name.trim(),
        title: title.trim() || null,
        phone: phone.trim() || null,
      })
      setDirty(false)
      toast.success("Profile saved")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to save profile")
    } finally {
      setSaving(false)
    }
  }

  async function onPhotoSelected(file: File | null) {
    if (!file) return
    setPhotoState("uploading")
    setPhotoError(null)
    try {
      const form = new FormData()
      form.append("photo", file)
      const res = await uploadProfilePhoto(form)
      updateUser({
        ...(res.data || {}),
        avatarUrl: res.data?.avatarUrl || res.data?.photoUrl,
        photoUrl: res.data?.photoUrl || res.data?.avatarUrl,
      })
      setPhotoState("idle")
      toast.success("Photo uploaded")
    } catch (err) {
      setPhotoState("error")
      setPhotoError(err instanceof ApiError ? err.message : "Photo upload failed")
      toast.error(err instanceof ApiError ? err.message : "Photo upload failed")
    }
  }

  return (
    <AccountShell
      title="Profile"
      description="Your personal Cosmos profile for this account. Email is managed with sign-in and cannot be edited here."
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={!dirty || saving}
            onClick={() => {
              setName(user?.name || "")
              setTitle(user?.title || "")
              setPhone(user?.phone || "")
              setDirty(false)
            }}
          >
            Discard
          </Button>
          <Button size="sm" disabled={!dirty || saving} onClick={() => void saveProfile()}>
            {saving ? <Loader2Icon className="animate-spin" /> : null}
            Save Changes
          </Button>
        </>
      }
    >
      <div className="hub-account-split">
        <section className="hub-records-panel hub-account-form">
          <header className="hub-reports-panel-head">
            <h2>Profile</h2>
            {dirty ? <span className="hub-reports-chip is-info">Unsaved changes</span> : null}
          </header>

          <div className="hub-account-section">
            <div className="hub-account-section-label">
              <strong>Photo</strong>
              <p>Shown on your profile and people cards. Initials appear when there is no photo.</p>
            </div>
            <div className="hub-account-photo">
              <Avatar className="hub-account-photo-avatar">
                {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
                <AvatarFallback>{initials(user?.name, user?.email)}</AvatarFallback>
              </Avatar>
              <div className="hub-account-photo-actions">
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => void onPhotoSelected(e.target.files?.[0] || null)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={photoState === "uploading"}
                  onClick={() => photoRef.current?.click()}
                >
                  {photoState === "uploading" ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <UploadIcon />
                  )}
                  Upload Photo
                </Button>
                <Button size="sm" variant="ghost" disabled title="Photo removal API is not available">
                  Remove
                </Button>
                {photoError ? <small className="hub-account-error">{photoError}</small> : null}
              </div>
            </div>
          </div>

          <div className="hub-account-section">
            <div className="hub-account-section-label">
              <strong>Name</strong>
              <p>Your full name is used across Hub and Agency OS.</p>
            </div>
            <div className="hub-account-fields">
              <div>
                <Label htmlFor="hub-account-name">Full name</Label>
                <Input
                  id="hub-account-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setDirty(true)
                  }}
                  required
                />
              </div>
              <div>
                <Label htmlFor="hub-account-display">Display name</Label>
                <Input id="hub-account-display" value={name.split(/\s+/)[0] || ""} disabled />
                <small>Display name is derived until a dedicated field exists.</small>
              </div>
              <div>
                <Label htmlFor="hub-account-pronouns">Pronouns</Label>
                <Input id="hub-account-pronouns" disabled placeholder="Unavailable" />
                <small>Pronouns are not stored on the user model yet.</small>
              </div>
              <div>
                <Label htmlFor="hub-account-title">Role or title</Label>
                <Input
                  id="hub-account-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    setDirty(true)
                  }}
                  placeholder="e.g. Producer"
                />
              </div>
            </div>
          </div>

          <div className="hub-account-section">
            <div className="hub-account-section-label">
              <strong>About</strong>
              <p>A short professional description.</p>
            </div>
            <div className="hub-admin-unavailable" role="status">
              <UserIcon />
              <div>
                <strong>Bio unavailable</strong>
                <p>There is no bio field on the authenticated user profile yet.</p>
              </div>
            </div>
          </div>

          <div className="hub-account-section">
            <div className="hub-account-section-label">
              <strong>Contact</strong>
              <p>Email stays locked to the signed-in identity.</p>
            </div>
            <div className="hub-account-fields">
              <div>
                <Label htmlFor="hub-account-email">Primary email</Label>
                <Input id="hub-account-email" value={user?.email || ""} disabled />
                <small>Managed with your sign-in credentials.</small>
              </div>
              <div>
                <Label htmlFor="hub-account-phone">Work phone</Label>
                <Input
                  id="hub-account-phone"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setDirty(true)
                  }}
                  placeholder="+1 …"
                />
              </div>
              <div>
                <Label htmlFor="hub-account-mobile">Mobile</Label>
                <Input id="hub-account-mobile" disabled placeholder="Unavailable" />
                <small>Separate mobile is not modeled; use work phone.</small>
              </div>
              <div>
                <Label htmlFor="hub-account-location">Location</Label>
                <Input id="hub-account-location" disabled placeholder="Unavailable" />
              </div>
            </div>
          </div>
        </section>

        <aside className="hub-account-preview">
          <small>Preview</small>
          <div className="hub-account-preview-card">
            <div className="hub-account-preview-cover" />
            <Avatar className="hub-account-preview-avatar">
              {photoUrl ? <AvatarImage src={photoUrl} alt="" /> : null}
              <AvatarFallback>{initials(name || user?.name, user?.email)}</AvatarFallback>
            </Avatar>
            <strong>{name.trim() || user?.name || "—"}</strong>
            <p>{title.trim() || user?.title || "No title"}</p>
            <span>{user?.email}</span>
            {phone.trim() ? <span>{phone.trim()}</span> : null}
          </div>
          <p className="hub-records-footnote">
            Guest and portal visibility previews require Privacy & Visibility APIs that are not
            built yet.
          </p>
        </aside>
      </div>
    </AccountShell>
  )
}

export function HubAccountSecurityPage() {
  const { logout } = useAuth()
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)

  async function onChangePassword(event: FormEvent) {
    event.preventDefault()
    if (newPassword !== confirm) {
      toast.error("New passwords do not match")
      return
    }
    setSaving(true)
    try {
      await changePassword(oldPassword, newPassword)
      setOldPassword("")
      setNewPassword("")
      setConfirm("")
      toast.success("Password updated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to change password")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AccountShell
      title="Sign-In & Security"
      description="Password changes use your authenticated session. Passkeys, two-step verification, recovery codes, and device sessions are designed but not available yet."
    >
      <div className="hub-account-stack">
        <section className="hub-records-panel">
          <header className="hub-reports-panel-head">
            <h2>Sign-in methods</h2>
          </header>
          <ul className="hub-account-method-list">
            <li>
              <span className="hub-records-avatar">
                <KeyRoundIcon />
              </span>
              <div>
                <strong>Passkeys</strong>
                <small>Add and manage device passkeys</small>
              </div>
              <span className="hub-reports-chip is-neutral">Unavailable</span>
            </li>
            <li>
              <span className="hub-records-avatar">
                <Building2Icon />
              </span>
              <div>
                <strong>Single sign-on</strong>
                <small>Organization SSO is not configured in this build</small>
              </div>
              <span className="hub-reports-chip is-neutral">Unavailable</span>
            </li>
            <li>
              <span className="hub-records-avatar">
                <LockIcon />
              </span>
              <div>
                <strong>Password</strong>
                <small>Change the password for this Cosmos account</small>
              </div>
              <span className="hub-reports-chip is-success">Supported</span>
            </li>
          </ul>
          <form className="hub-account-password" onSubmit={(e) => void onChangePassword(e)}>
            <div>
              <Label htmlFor="hub-old-password">Current password</Label>
              <Input
                id="hub-old-password"
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="hub-new-password">New password</Label>
              <Input
                id="hub-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div>
              <Label htmlFor="hub-confirm-password">Confirm new password</Label>
              <Input
                id="hub-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2Icon className="animate-spin" /> : null}
              Update password
            </Button>
          </form>
        </section>

        <section className="hub-records-panel">
          <header className="hub-reports-panel-head">
            <h2>Two-step verification</h2>
          </header>
          <div className="hub-admin-unavailable" role="status">
            <ShieldIcon />
            <div>
              <strong>Two-step verification unavailable</strong>
              <p>
                Authenticator apps, recovery email, and recovery codes need an identity provider
                (IDENTITY_ACCESS §9). No codes or success states are simulated.
              </p>
            </div>
          </div>
        </section>

        <section className="hub-records-panel">
          <header className="hub-reports-panel-head">
            <h2>Active sessions</h2>
          </header>
          <div className="hub-admin-unavailable" role="status">
            <LockIcon />
            <div>
              <strong>Session list unavailable</strong>
              <p>
                Trusted devices and remote sign-out everywhere require a session store that is not
                exposed yet. You can sign out of this browser only.
              </p>
              <Button size="sm" variant="outline" onClick={logout}>
                Sign out this device
              </Button>
            </div>
          </div>
        </section>

        <section className="hub-records-panel">
          <header className="hub-reports-panel-head">
            <h2>Account</h2>
          </header>
          <div className="hub-admin-actions">
            <Button size="sm" variant="outline" disabled title="Data export API is not available">
              Download My Data
            </Button>
            <Button size="sm" variant="destructive" disabled title="Account deletion API is not available">
              Delete Account
            </Button>
          </div>
          <p className="hub-records-footnote">
            Deleting an account would remove membership across organizations. That flow is not
            implemented.
          </p>
        </section>
      </div>
    </AccountShell>
  )
}

export function HubAccountPrivacyPage() {
  return (
    <AccountShell
      title="Privacy & Visibility"
      description="Field × audience visibility is designed for Personal Account. No privacy policy API exists yet, so settings are not editable."
    >
      <div className="hub-admin-unavailable" role="status">
        <EyeIcon />
        <div>
          <strong>Privacy controls unavailable</strong>
          <p>
            Who-can-see matrices, per-organization overrides, directory/mention toggles, and guest
            previews are Proposed (IDENTITY_ACCESS). Nothing is invented as live configuration.
          </p>
        </div>
      </div>
    </AccountShell>
  )
}

export function HubAccountOrganizationsPage() {
  const { user } = useAuth()
  return (
    <AccountShell
      title="Organizations & Roles"
      description="Memberships for this Cosmos identity. Multi-organization switching is not supported yet — only the current agency is shown."
    >
      <div className="hub-account-stack">
        <div className="hub-admin-unavailable" role="status">
          <ShieldIcon />
          <div>
            <strong>Roles are set by organization administrators</strong>
            <p>
              You can see your access here, but you cannot change your own role. Request-a-change
              delivery is not wired.
            </p>
            <Button size="sm" variant="outline" disabled>
              Request A Change
            </Button>
          </div>
        </div>

        <section className="hub-records-panel">
          <div className="hub-account-org-card">
            <span className="hub-records-avatar is-lg">
              {initials(user?.agencyName || "Org")}
            </span>
            <div>
              <div className="hub-records-hero-title">
                <h2>{user?.agencyName || "Current organization"}</h2>
                <span className="hub-reports-chip is-success">Current</span>
              </div>
              <p className="hub-records-hero-sub">
                {roleLabel(user?.role || "member")}
                {user?.permissionRole ? ` · ${user.permissionRole.replace(/_/g, " ")}` : ""}
                {user?.jobFunction ? ` · ${user.jobFunction}` : ""}
              </p>
            </div>
            <Button size="sm" variant="outline" render={<Link to="/hub" />}>
              Open Hub
            </Button>
          </div>
          <dl className="hub-records-kv" style={{ marginTop: 16 }}>
            <div>
              <dt>Title</dt>
              <dd>{user?.title || "—"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user?.email || "—"}</dd>
            </div>
            <div>
              <dt>Seat / editions</dt>
              <dd className="hub-records-locked">
                <LockIcon /> Live seat and edition assignment unavailable
              </dd>
            </div>
          </dl>
        </section>

        <div className="hub-admin-unavailable" role="status">
          <Building2Icon />
          <div>
            <strong>Additional organizations unavailable</strong>
            <p>
              Guest memberships in other organizations require multi-org Bridges that are not
              modeled in this agency schema.
            </p>
          </div>
        </div>
      </div>
    </AccountShell>
  )
}

export function HubAccountPreferencesPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [increaseContrast, setIncreaseContrast] = useState(false)
  const [largeText, setLargeText] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = JSON.parse(localStorage.getItem("cosmos.display-preferences") || "{}") as {
        reduceMotion?: boolean
        increaseContrast?: boolean
        largeText?: boolean
      }
      setReduceMotion(saved.reduceMotion === true)
      setIncreaseContrast(saved.increaseContrast === true)
      setLargeText(saved.largeText === true)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    const next = { reduceMotion, increaseContrast, largeText }
    localStorage.setItem("cosmos.display-preferences", JSON.stringify(next))
    document.documentElement.dataset.cosmosReduceMotion = String(reduceMotion)
    document.documentElement.dataset.cosmosHighContrast = String(increaseContrast)
    document.documentElement.dataset.cosmosLargeText = String(largeText)
  }, [mounted, reduceMotion, increaseContrast, largeText])

  return (
    <AccountShell
      title="Preferences"
      description="Appearance follows this device. Notification channel matrices and quiet hours are not backed by an API yet."
    >
      <div className="hub-account-stack">
        <section className="hub-records-panel">
          <header className="hub-reports-panel-head">
            <h2>Notifications</h2>
          </header>
          <div className="hub-admin-unavailable" role="status">
            <SlidersHorizontalIcon />
            <div>
              <strong>Notification preferences unavailable</strong>
              <p>
                In-app, email, and mobile channel toggles plus quiet hours need a personal
                preferences store that is not implemented.
              </p>
            </div>
          </div>
        </section>

        <section className="hub-records-panel">
          <header className="hub-reports-panel-head">
            <h2>Language & region</h2>
          </header>
          <div className="hub-admin-unavailable" role="status">
            <SlidersHorizontalIcon />
            <div>
              <strong>Locale settings unavailable</strong>
              <p>Language, time zone, and date formats are not stored on the user profile yet.</p>
            </div>
          </div>
        </section>

        <section className="hub-records-panel">
          <header className="hub-reports-panel-head">
            <h2>Accessibility & display</h2>
          </header>
          <div className="hub-account-pref-row">
            <div>
              <strong>Appearance</strong>
              <small>
                {mounted ? `Currently ${resolvedTheme || theme || "system"}` : "Loading…"}
              </small>
            </div>
            <div className="hub-account-seg">
              {(["system", "light", "dark"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn(theme === value && "is-active")}
                  onClick={() => setTheme(value)}
                >
                  {value === "system" ? "System" : value === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </div>
          <div className="hub-account-pref-row">
            <div>
              <strong>Reduce motion</strong>
              <small>Stored on this device only</small>
            </div>
            <button
              type="button"
              className={cn("hub-account-toggle", reduceMotion && "is-on")}
              aria-pressed={reduceMotion}
              onClick={() => setReduceMotion((v) => !v)}
            />
          </div>
          <div className="hub-account-pref-row">
            <div>
              <strong>Increase contrast</strong>
              <small>Stored on this device only</small>
            </div>
            <button
              type="button"
              className={cn("hub-account-toggle", increaseContrast && "is-on")}
              aria-pressed={increaseContrast}
              onClick={() => setIncreaseContrast((v) => !v)}
            />
          </div>
          <div className="hub-account-pref-row">
            <div>
              <strong>Text size</strong>
              <small>Large text on this device</small>
            </div>
            <div className="hub-account-seg">
              <button
                type="button"
                className={cn(!largeText && "is-active")}
                onClick={() => setLargeText(false)}
              >
                Default
              </button>
              <button
                type="button"
                className={cn(largeText && "is-active")}
                onClick={() => setLargeText(true)}
              >
                Large
              </button>
            </div>
          </div>
        </section>
      </div>
    </AccountShell>
  )
}

export function HubAccountPage() {
  return <HubAccountProfilePage />
}
