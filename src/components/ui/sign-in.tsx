import React, { useState } from "react"
import { Eye, EyeOff, KeyRound, Mail, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/ui/logo"

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
)

export interface Testimonial {
  avatarSrc: string
  name: string
  handle: string
  text: string
}

interface SignInPageProps {
  title?: React.ReactNode
  description?: string
  heroImageSrc?: string
  testimonials?: Testimonial[]
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void
  onSignUp?: (event: React.FormEvent<HTMLFormElement>) => void
  onGoogleSignIn?: () => void
  onResetPassword?: () => void
  onRequestPasswordReset?: (email: string) => Promise<{ success: boolean; message?: string } | void>
  error?: string | null
  successMessage?: string | null
  pending?: boolean
  isSignUp?: boolean
  onModeChange?: (isSignUp: boolean) => void
}

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
    {children}
  </div>
)

const TestimonialCard = ({ testimonial, delay }: { testimonial: Testimonial; delay: string }) => (
  <div className={`animate-testimonial ${delay} flex items-start gap-3 rounded-3xl bg-black/30 backdrop-blur-xl border border-white/10 p-5 w-64`}>
    <img src={testimonial.avatarSrc} className="h-10 w-10 object-cover rounded-2xl" alt="avatar" />
    <div className="text-sm leading-snug text-white">
      <p className="flex items-center gap-1 font-medium">{testimonial.name}</p>
      <p className="text-white/60">{testimonial.handle}</p>
      <p className="mt-1 text-white/80">{testimonial.text}</p>
    </div>
  </div>
)

export const SignInPage: React.FC<SignInPageProps> = ({
  title = <span className="font-light tracking-tighter">Welcome</span>,
  description = "Access your account and continue your journey with us",
  heroImageSrc = "/astra_portal.jpeg",
  testimonials = [],
  onSignIn,
  onSignUp,
  onGoogleSignIn,
  onResetPassword,
  onRequestPasswordReset,
  error,
  successMessage,
  pending,
  isSignUp: controlledIsSignUp,
  onModeChange,
}) => {
  const [internalIsSignUp, setInternalIsSignUp] = useState(false)
  const isSignUp = controlledIsSignUp !== undefined ? controlledIsSignUp : internalIsSignUp
  const setIsSignUp = (val: boolean) => {
    setInternalIsSignUp(val)
    onModeChange?.(val)
  }

  const [showPassword, setShowPassword] = useState(false)
  const canSignUp = !!onSignUp

  // Modal State for Forgot / Reset Password
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetPending, setResetPending] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState<string | null>(null)

  const handleOpenResetModal = () => {
    setResetError(null)
    setResetSuccess(null)
    setShowResetModal(true)
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail || !resetEmail.trim() || !resetEmail.includes("@")) {
      setResetError("Please enter a valid email address.")
      return
    }

    setResetPending(true)
    setResetError(null)
    setResetSuccess(null)

    try {
      if (onRequestPasswordReset) {
        const result = await onRequestPasswordReset(resetEmail.trim())
        if (result && !result.success) {
          setResetError(result.message || "Unable to send reset instructions.")
        } else {
          setResetSuccess("If an account is associated with this email, we've sent password reset instructions! Check your inbox and spam folder.")
        }
      } else if (onResetPassword) {
        onResetPassword()
        setResetSuccess("Password reset instructions dispatched.")
      }
    } catch (err: any) {
      setResetError(err?.message || "Failed to dispatch password reset. Please verify connection.")
    } finally {
      setResetPending(false)
    }
  }

  return (
    <div className="h-dvh w-dvw font-sans overflow-hidden bg-background text-foreground relative">
      <div className="relative flex h-full">

        {/* ── Left Panel: Sign Up Form ── */}
        {canSignUp && (
          <div className={cn(
            "absolute inset-0 md:relative md:w-1/2 shrink-0 flex items-center justify-center p-8 md:p-12 transition-all duration-500 ease-out",
            isSignUp
              ? "opacity-100 z-10"
              : "opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto md:z-0"
          )}>
            <div className={cn(
              "w-full max-w-md transition-all duration-500 ease-out",
              isSignUp ? "translate-y-0 delay-300" : "translate-y-4"
            )}>
              <Link to="/landing" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>

              <div className="mb-10">
                <Logo size="md" />
              </div>

              <div className="flex flex-col gap-5">
                <div>
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Create Account</h1>
                  <p className="text-sm text-muted-foreground mt-2">Join our platform and start your journey</p>
                </div>

                <form className="space-y-4" onSubmit={onSignUp}>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                    <GlassInputWrapper>
                      <input name="email" type="email" placeholder="Enter your email address" className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none" required />
                    </GlassInputWrapper>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Password</label>
                    <GlassInputWrapper>
                      <input name="password" type="password" placeholder="Create a password" className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none" required minLength={8} />
                    </GlassInputWrapper>
                  </div>

                  {isSignUp && error && (
                    <div className="text-sm text-destructive border border-destructive/20 bg-destructive/5 px-4 py-3 rounded-2xl">{error}</div>
                  )}

                  <button type="submit" disabled={pending} className="w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                    {pending ? "Creating account…" : "Create Account"}
                  </button>
                </form>

                <div className="relative flex items-center justify-center">
                  <span className="w-full border-t border-border" />
                  <span className="px-4 text-sm text-muted-foreground bg-background absolute whitespace-nowrap">Or continue with</span>
                </div>

                <button type="button" onClick={onGoogleSignIn} className="w-full flex items-center justify-center gap-3 border border-border rounded-2xl py-4 hover:bg-secondary transition-colors">
                  <GoogleIcon />
                  Continue with Google
                </button>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button type="button" onClick={() => setIsSignUp(false)} className="text-violet-400 hover:underline transition-colors font-medium">Sign In</button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Right Panel: Sign In Form ── */}
        <div className={cn(
          "absolute inset-0 md:relative md:w-1/2 shrink-0 flex items-center justify-center p-8 md:p-12 transition-all duration-500 ease-out",
          !canSignUp && "md:ml-auto",
          !isSignUp
            ? "opacity-100 z-10"
            : "opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto md:z-0"
        )}>
          <div className={cn(
            "w-full max-w-md transition-all duration-500 ease-out",
            !isSignUp ? "translate-y-0 delay-300" : "translate-y-4"
          )}>
            <Link to="/landing" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>

            <div className="mb-10">
              <Logo size="md" />
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <h1 className="text-3xl md:text-4xl font-semibold leading-tight">{title}</h1>
                <p className="text-sm text-muted-foreground mt-2">{description}</p>
              </div>

              <form className="space-y-4" onSubmit={onSignIn}>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                  <GlassInputWrapper>
                    <input
                      name="email"
                      type="email"
                      placeholder="Enter your email address"
                      className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none"
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                  </GlassInputWrapper>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Password</label>
                  <GlassInputWrapper>
                    <div className="relative">
                      <input name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none" required />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center">
                        {showPassword ? (
                          <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                        ) : (
                          <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                        )}
                      </button>
                    </div>
                  </GlassInputWrapper>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" name="rememberMe" className="rounded border-border" />
                    <span className="text-foreground/90">Keep me signed in</span>
                  </label>
                  <button type="button" onClick={handleOpenResetModal} className="hover:underline text-violet-400 transition-colors font-medium">
                    Forgot password?
                  </button>
                </div>

                {!isSignUp && successMessage && (
                  <div className="text-sm text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 rounded-2xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {!isSignUp && error && (
                  <div className="text-sm text-destructive border border-destructive/20 bg-destructive/5 px-4 py-3 rounded-2xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={pending} className="w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {pending ? "Signing in…" : "Sign In"}
                </button>
              </form>

              <div className="relative flex items-center justify-center">
                <span className="w-full border-t border-border" />
                <span className="px-4 text-sm text-muted-foreground bg-background absolute whitespace-nowrap">Or continue with</span>
              </div>

              <button type="button" onClick={onGoogleSignIn} className="w-full flex items-center justify-center gap-3 border border-border rounded-2xl py-4 hover:bg-secondary transition-colors">
                <GoogleIcon />
                Continue with Google
              </button>

              {canSignUp && (
                <p className="text-center text-sm text-muted-foreground">
                  New to our platform?{" "}
                  <button type="button" onClick={() => setIsSignUp(true)} className="text-violet-400 hover:underline transition-colors font-medium">Create Account</button>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Sliding Image Panel (desktop only) ── */}
        <div className={cn(
          "hidden md:block absolute top-0 bottom-0 w-1/2 z-20 transition-all duration-700 ease-in-out p-3",
          canSignUp && isSignUp ? "left-1/2" : "left-0"
        )}>
          <div className="relative h-full w-full rounded-3xl overflow-hidden bg-zinc-950/90 border border-white/10 flex items-center justify-center shadow-2xl">
            {/* Soft ambient background glow to fill edges seamlessly */}
            <img
              src={heroImageSrc}
              className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-30 scale-110 pointer-events-none select-none"
              alt=""
              aria-hidden="true"
            />
            {/* Main hero image rendered with crisp object-cover centering */}
            <img
              src={heroImageSrc}
              className="relative z-10 w-full h-full object-cover object-center select-none"
              alt="Hero graphic"
              loading="eager"
            />
            <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/75 via-transparent to-black/25 pointer-events-none" />

            {testimonials.length > 0 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-6 w-full justify-center z-30">
                <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
                {testimonials[1] && <div className="hidden xl:flex"><TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" /></div>}
                {testimonials[2] && <div className="hidden 2xl:flex"><TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" /></div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sleek Glassmorphic Forgot Password Modal ── */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-zinc-950/95 border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl overflow-hidden">
            {/* Ambient Violet Glow */}
            <div className="absolute -top-16 -left-16 w-36 h-36 bg-violet-600/30 rounded-full blur-3xl pointer-events-none" />

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowResetModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-violet-600/20 border border-violet-500/30 text-violet-400">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">Reset Password</h3>
                <p className="text-xs text-zinc-400">Astrablack &bull; Cosmos OS Security</p>
              </div>
            </div>

            <p className="text-sm text-zinc-300 mb-6 leading-relaxed">
              Enter your registered account email address. We will send a secure, 1-hour valid link to reset your password.
            </p>

            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                  Email Address
                </label>
                <div className="relative rounded-2xl border border-white/15 bg-white/5 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition-all">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoFocus
                    required
                    className="w-full bg-transparent pl-11 pr-4 py-3.5 text-sm text-white placeholder:text-zinc-500 rounded-2xl focus:outline-none"
                  />
                </div>
              </div>

              {resetSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{resetSuccess}</div>
                </div>
              )}

              {resetError && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{resetError}</div>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  type="submit"
                  disabled={resetPending}
                  className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm shadow-lg shadow-violet-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {resetPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending link...</span>
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="w-full py-2.5 rounded-2xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
