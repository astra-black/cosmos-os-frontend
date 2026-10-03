import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { acceptPortalInvite, validatePortalInviteToken } from "@/lib/api/platform"

type Phase = "validating" | "invalid" | "setup" | "success"

export function PortalJoinPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get("token") ?? ""

  const [phase, setPhase] = useState<Phase>("validating")
  const [tokenData, setTokenData] = useState<{ email: string; clientName: string; agencyName: string } | null>(null)
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) { setPhase("invalid"); return }
    let cancelled = false
    async function validate() {
      try {
        const res = await validatePortalInviteToken(token)
        if (!cancelled && res.data?.valid) {
          setTokenData({
            email: res.data.email ?? "",
            clientName: res.data.clientName ?? "",
            agencyName: res.data.agencyName ?? "",
          })
          setName(res.data.name ?? "")
          setPhase("setup")
        } else if (!cancelled) {
          setPhase("invalid")
        }
      } catch {
        if (!cancelled) setPhase("invalid")
      }
    }
    void validate()
    return () => { cancelled = true }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return }
    if (password !== confirm) { toast.error("Passwords do not match"); return }
    setBusy(true)
    try {
      const res = await acceptPortalInvite({ token, password, name: name.trim() })
      // Store session exactly like PortalLoginPage does
      localStorage.setItem(
        "cosmos.portalUser",
        JSON.stringify({ ...res.data, token: res.token, role: "client" })
      )
      setPhase("success")
      setTimeout(() => navigate("/portal", { replace: true }), 1200)
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to activate portal access")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-sky-950 via-slate-900 to-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-sky-800/40 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl">
        {/* Logo / Brand */}
        <div className="mb-6 flex flex-col items-center gap-1 text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/20 ring-1 ring-sky-500/40">
            <svg className="size-6 text-sky-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Activate Portal Access</h1>
          {tokenData && (
            <p className="text-sm text-sky-300/80">
              {tokenData.agencyName} · {tokenData.clientName}
            </p>
          )}
        </div>

        {/* Validating */}
        {phase === "validating" && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full rounded-lg bg-slate-800" />
            <Skeleton className="h-10 w-full rounded-lg bg-slate-800" />
            <Skeleton className="h-10 w-full rounded-lg bg-slate-800" />
          </div>
        )}

        {/* Invalid / expired */}
        {phase === "invalid" && (
          <div className="rounded-xl border border-red-800/40 bg-red-950/30 p-5 text-center">
            <p className="font-semibold text-red-400">Invite link is invalid or has expired.</p>
            <p className="mt-1 text-sm text-slate-400">
              Ask your agency to send a fresh invitation.
            </p>
          </div>
        )}

        {/* Password setup form */}
        {phase === "setup" && tokenData && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="rounded-lg border border-sky-800/30 bg-sky-950/20 px-4 py-2.5 text-sm text-sky-300">
              Signing in as <span className="font-semibold">{tokenData.email}</span>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="portal-join-name" className="text-slate-300">Your name</Label>
              <Input
                id="portal-join-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500"
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="portal-join-pw" className="text-slate-300">Create password</Label>
              <Input
                id="portal-join-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500"
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="portal-join-confirm" className="text-slate-300">Confirm password</Label>
              <Input
                id="portal-join-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                className="border-slate-700 bg-slate-800/60 text-white placeholder:text-slate-500"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={busy || !password || !confirm}
              className="mt-1 bg-sky-600 text-white hover:bg-sky-500"
            >
              {busy ? "Activating…" : "Activate Portal Access →"}
            </Button>
          </form>
        )}

        {/* Success state */}
        {phase === "success" && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-400/40">
              <svg className="size-7 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="font-semibold text-emerald-400">Access activated!</p>
            <p className="text-sm text-slate-400">Redirecting you to your portal…</p>
          </div>
        )}
      </div>
    </div>
  )
}
