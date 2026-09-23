import React, { useState, useEffect } from "react"
import { X, Sparkles, Building2, User, Briefcase, Phone, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth"
import { completeOnboarding, dismissOnboarding } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"

const JOB_FUNCTIONS = [
  { value: "ADMIN", label: "Agency Admin & Operations" },
  { value: "CREATIVE", label: "Creative & Design" },
  { value: "PRODUCER", label: "Live Production & Events" },
  { value: "PM", label: "Project & Task Management" },
  { value: "OPS", label: "Client & Account Lead" },
]

export function OnboardingProfileModal() {
  const { user, updateUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState("")
  const [title, setTitle] = useState("")
  const [agencyName, setAgencyName] = useState("")
  const [phone, setPhone] = useState("")
  const [jobFunction, setJobFunction] = useState("ADMIN")

  useEffect(() => {
    if (!user?.id) {
      setOpen(false)
      return
    }

    // Modal triggers only when onboardingCompletedAt is null AND not in localStorage
    const isCompleted =
      Boolean(user.onboardingCompletedAt) ||
      localStorage.getItem(`cosmos.onboarding_completed_${user.id}`) === "true"
    const sessionDismissed =
      sessionStorage.getItem(`cosmos.onboarding_dismissed_${user.id}`) === "true" ||
      localStorage.getItem(`cosmos.onboarding_dismissed_${user.id}`) === "true"

    if (!isCompleted && !sessionDismissed) {
      setName(user.name || (user.email ? user.email.split("@")[0] : ""))
      setAgencyName(user.agencyName || "")
      setTitle(user.title || "")
      setPhone(user.phone || "")
      setJobFunction((user.jobFunction as string) || "ADMIN")
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [user?.id, user?.name, user?.agencyName, user?.email, user?.title, user?.phone, user?.jobFunction, user?.onboardingCompletedAt])

  const handleDismiss = async () => {
    if (user?.id) {
      localStorage.setItem(`cosmos.onboarding_completed_${user.id}`, "true")
      sessionStorage.setItem(`cosmos.onboarding_dismissed_${user.id}`, "true")
      try {
        await dismissOnboarding()
      } catch {
        // ignore network error on dismiss
      }
      updateUser({ onboardingCompletedAt: new Date().toISOString() })
    }
    setOpen(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setSaving(true)

    try {
      const payload = {
        fullName: name.trim() || user.name,
        agencyName: agencyName.trim() || user.agencyName,
        jobTitle: title.trim(),
        phone: phone.trim(),
        primaryRoleFocus: jobFunction,
      }

      const res = await completeOnboarding(payload)
      const now = new Date().toISOString()

      localStorage.setItem(`cosmos.onboarding_completed_${user.id}`, "true")
      sessionStorage.setItem(`cosmos.onboarding_dismissed_${user.id}`, "true")

      updateUser({
        ...(res.data?.user || {}),
        name: payload.fullName,
        agencyName: payload.agencyName,
        title: payload.jobTitle,
        phone: payload.phone,
        jobFunction: payload.primaryRoleFocus,
        onboardingCompletedAt: now,
      })

      toast.success("Profile setup complete! Welcome to Cosmos OS.")
      setOpen(false)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : (err as Error)?.message || "Failed to update profile"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-300"
        onClick={handleDismiss}
      />

      {/* Modal Card */}
      <div className="relative z-50 w-full max-w-lg rounded-2xl border border-border bg-card/95 p-6 md:p-8 text-card-foreground shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-300">
        {/* Top-Left Cross (X) Close Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 left-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors border border-border/50"
          aria-label="Close profile modal"
          title="Skip / Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Top Header Badge */}
        <div className="flex flex-col items-center text-center mt-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Workspace Profile Setup</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to Cosmos OS
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
            Set up your details to personalize your workspace, client deliverables, and team collaboration.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ob-name" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Full Name
            </Label>
            <Input
              id="ob-name"
              type="text"
              placeholder="e.g. Alex Mercer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 bg-background/50"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ob-title" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> Job Title
              </Label>
              <Input
                id="ob-title"
                type="text"
                placeholder="e.g. Creative Director"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 bg-background/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ob-phone" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> Phone (Optional)
              </Label>
              <Input
                id="ob-phone"
                type="tel"
                placeholder="e.g. +1 (555) 019-2834"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 bg-background/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-agency" className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Agency / Company Name
            </Label>
            <Input
              id="ob-agency"
              type="text"
              placeholder="e.g. Astra Media Group"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="h-10 bg-background/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-function" className="text-xs font-medium text-muted-foreground">
              Primary Role Focus
            </Label>
            <select
              id="ob-function"
              value={jobFunction}
              onChange={(e) => setJobFunction(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background/50 px-3 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-2"
            >
              {JOB_FUNCTIONS.map((jf) => (
                <option key={jf.value} value={jf.value}>
                  {jf.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline order-2 sm:order-1"
            >
              Skip for now
            </button>

            <Button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 h-10 rounded-xl font-medium gap-1.5 order-1 sm:order-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? "Saving…" : "Save & Continue"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
