import { useState } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import { Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react"
import { resetPassword } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { Button } from "@/components/ui/button"

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get("token") || ""
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      setError("Missing or invalid password reset token. Please request a new link.")
      return
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please verify and retry.")
      return
    }

    setPending(true)
    setError(null)
    try {
      await resetPassword(token, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password. Link may have expired.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground relative overflow-hidden font-sans">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-card/70 backdrop-blur-xl border border-border/80 rounded-3xl p-8 shadow-2xl space-y-6 relative z-10">
        <div className="space-y-2 text-center">
          <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary mb-3">
            <KeyRound className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Set New Password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below to regain access to Cosmos OS.
          </p>
        </div>

        {success ? (
          <div className="space-y-5 text-center">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-3">
              <CheckCircle2 className="size-5 shrink-0" />
              <div className="text-left font-medium">
                Password reset successfully! You can now log in with your new credentials.
              </div>
            </div>

            <Button
              className="w-full rounded-2xl bg-primary py-5 font-semibold"
              onClick={() => navigate("/login")}
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2.5">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-foreground/5 border border-border rounded-2xl p-3.5 pr-12 text-sm focus:outline-none focus:border-primary transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Re-type new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-foreground/5 border border-border rounded-2xl p-3.5 text-sm focus:outline-none focus:border-primary transition-colors"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={pending || !token}
              className="w-full rounded-2xl bg-primary py-5 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 mt-2"
            >
              {pending ? "Updating password…" : "Reset Password"}
            </Button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
