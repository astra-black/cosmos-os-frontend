import React, { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
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
  error?: string | null
  pending?: boolean
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
  error,
  pending,
}) => {
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const canSignUp = !!onSignUp

  return (
    <div className="h-dvh w-dvw font-sans overflow-hidden bg-background text-foreground">
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
                    <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                    <GlassInputWrapper>
                      <input name="name" type="text" placeholder="Enter your full name" className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none" required />
                    </GlassInputWrapper>
                  </div>

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
                    <input name="email" type="email" placeholder="Enter your email address" className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none" required />
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
                  <button type="button" onClick={onResetPassword} className="hover:underline text-violet-400 transition-colors">Reset password</button>
                </div>

                {!isSignUp && error && (
                  <div className="text-sm text-destructive border border-destructive/20 bg-destructive/5 px-4 py-3 rounded-2xl">{error}</div>
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
          <div className="relative h-full w-full rounded-3xl overflow-hidden">
            <img src={heroImageSrc} className="absolute inset-0 w-full h-full object-cover" alt="" />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-black/20" />

            {testimonials.length > 0 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-6 w-full justify-center">
                <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
                {testimonials[1] && <div className="hidden xl:flex"><TestimonialCard testimonial={testimonials[1]} delay="animate-delay-1200" /></div>}
                {testimonials[2] && <div className="hidden 2xl:flex"><TestimonialCard testimonial={testimonials[2]} delay="animate-delay-1400" /></div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
