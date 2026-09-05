import { useEffect, useState } from "react"
import { useNavigate, useParams, Link } from "react-router-dom"
import { CheckCircle2Icon, Loader2Icon, ShieldAlertIcon, SparklesIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { acceptInvitation, getInvitationDetails, type InvitationData } from "@/lib/api/auth"
import { ApiError, setSession } from "@/lib/api/client"

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invite, setInvite] = useState<InvitationData | null>(null)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided.")
      setLoading(false)
      return
    }

    let isMounted = true
    async function fetchInvite() {
      try {
        const res = await getInvitationDetails(token!)
        if (isMounted) {
          setInvite(res.data)
          if (res.data.email) {
            setEmail(res.data.email)
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof ApiError ? err.message : "Invalid or expired invitation link.")
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void fetchInvite()
    return () => {
      isMounted = false
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    if (!name.trim()) {
      toast.error("Please enter your full name.")
      return
    }

    const finalEmail = (invite?.email || email).trim()
    if (!finalEmail) {
      toast.error("Please enter your email address.")
      return
    }

    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters long.")
      return
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.")
      return
    }

    setSubmitting(true)
    try {
      const res = await acceptInvitation({
        token,
        name: name.trim(),
        email: finalEmail,
        password,
      })

      if (res.data?.accessToken && res.data?.user) {
        setSession({
          accessToken: res.data.accessToken,
          refreshToken: res.data.accessToken,
          user: res.data.user,
        })
      }

      toast.success(`Welcome to ${invite?.agencyName || "the workspace"}!`)
      // Refresh to reload auth state in context
      window.location.href = "/dashboard"
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to accept invitation."
      toast.error(msg)
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2Icon className="size-8 animate-spin text-primary" />
          <p className="text-sm">Verifying invitation link...</p>
        </div>
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive/30 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlertIcon className="size-6" />
            </div>
            <CardTitle className="text-xl">Invitation Unavailable</CardTitle>
            <CardDescription className="mt-2 text-sm text-foreground/80">{error}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Link to="/login">
              <Button variant="outline">Back to Sign In</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-2xl border-border/80">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <SparklesIcon className="size-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Join Workspace</CardTitle>
          <CardDescription className="text-sm">
            You have been invited to join{" "}
            <span className="font-semibold text-foreground">{invite?.agencyName || "the team"}</span>
            {invite?.invitedBy ? ` by ${invite.invitedBy}` : ""}.
          </CardDescription>
          <div className="pt-2 flex items-center justify-center gap-2">
            <Badge variant="secondary" className="capitalize">
              <UsersIcon className="mr-1 size-3" />
              {invite?.permissionRole?.replace(/_/g, " ").toLowerCase() || "Team Member"}
            </Badge>
            {invite?.jobFunction && (
              <Badge variant="outline" className="uppercase text-xs">
                {invite.jobFunction}
              </Badge>
            )}
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-2">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={invite?.email || email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={Boolean(invite?.email)}
                required
                placeholder="you@company.com"
                className={invite?.email ? "bg-muted/50 cursor-not-allowed" : ""}
              />
              {invite?.email && (
                <p className="text-[11px] text-muted-foreground">This invitation is assigned to this email address.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">Your Full Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jane Doe"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 6 characters"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter your password"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button type="submit" className="w-full gap-2 font-medium" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <CheckCircle2Icon className="size-4" />
                  Accept Invite & Join
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
                Sign in instead
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
