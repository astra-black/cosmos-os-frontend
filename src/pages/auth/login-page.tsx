import { useState, type FormEvent } from "react"
import { Navigate, useNavigate, Link } from "react-router-dom"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("admin@cosmos.com")
  const [password, setPassword] = useState("admin123")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await login(email, password)
      navigate("/dashboard", { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="astra-black-theme min-h-screen w-full flex items-center justify-center p-4 bg-[#060110] relative font-sans text-[#EDE9F7] antialiased">
      {/* Dynamic background lights */}
      <div className="glow" aria-hidden="true" />

      {/* Floating Theme Toggle */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Clean centered card window */}
      <div className="relative w-full max-w-[1020px] bg-[#0d0620]/60 border border-[#241a42] rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(110,40,255,0.15)] backdrop-blur-xl min-h-[640px]">
        
        {/* Sliding Graphic Banner (absolute overlay) */}
        <div 
          className={cn(
            "hidden md:block absolute top-0 bottom-0 w-1/2 z-20 transition-all duration-500 ease-in-out overflow-hidden bg-[#060110]",
            isSignUp 
              ? "left-1/2 rounded-r-3xl border-l border-[#241a42]" 
              : "left-0 rounded-l-3xl border-r border-[#241a42]"
          )}
        >
          <img 
            src="/login_hero.jpg" 
            alt="Oracle Cosmos Orb illustration" 
            className="absolute inset-0 w-full h-full object-cover object-center opacity-85" 
          />
          {/* Accent lighting gradients overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#060110] via-transparent to-transparent opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d0620]/40 to-transparent pointer-events-none" />

          {/* Logo overlay on top-left of image */}
          <div className="absolute top-8 left-8 flex items-center gap-2.5 z-10">
            <img src="/logo.png" alt="Astra Black logo" className="h-7 w-auto rounded-md shadow-md" />
            <span className="font-extrabold tracking-[0.25em] text-white text-md">
              ASTRA<span className="text-[#CAB2FD]">BLACK</span>
            </span>
          </div>
        </div>

        {/* Flex layout holding both form structures */}
        <div className="flex flex-col md:flex-row min-h-[640px] relative">
          
          {/* Left Panel: Sign Up / Waitlist Card */}
          <div 
            className={cn(
              "w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center transition-all duration-500 ease-in-out",
              isSignUp 
                ? "opacity-100 translate-x-0 z-10" 
                : "opacity-0 -translate-x-12 pointer-events-none hidden md:flex"
            )}
          >
            <div className="max-w-[380px] w-full mx-auto">
              <h2 className="text-[32px] font-black text-white tracking-tight mb-1 font-sans">
                Sign up
              </h2>
              <p className="text-xs text-[#7E769B] mb-8 font-light">
                Already have an account?{" "}
                <button 
                  onClick={() => setIsSignUp(false)} 
                  className="text-[#9664FF] hover:underline font-semibold cursor-pointer"
                >
                  Log in
                </button>
              </p>

              <div className="bg-[#140b2a]/60 border border-[#241a42] rounded-2xl p-6 mb-8 text-left">
                <p className="text-xs text-[#B3ABC9] leading-relaxed mb-5">
                  Astra Black is currently in private beta. To request an invite and secure your queue position, please join our Waitlist.
                </p>
                <Link 
                  to="/landing" 
                  className="btn w-full justify-center text-xs text-center block cursor-pointer"
                >
                  Join Waitlist
                </Link>
              </div>

              <Link 
                to="/" 
                className="flex items-center gap-1.5 text-xs text-[#7E769B] hover:text-white transition-colors"
              >
                ← Back to home
              </Link>
            </div>
          </div>

          {/* Right Panel: Clean Login Form */}
          <div 
            className={cn(
              "w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center transition-all duration-500 ease-in-out ml-auto",
              !isSignUp 
                ? "opacity-100 translate-x-0 z-10" 
                : "opacity-0 translate-x-12 pointer-events-none hidden md:flex"
            )}
          >
            <div className="max-w-[380px] w-full mx-auto">
              {/* Back to landing page */}
              <Link 
                to="/" 
                className="flex items-center gap-1.5 text-xs text-[#7E769B] hover:text-white mb-8 transition-colors"
              >
                ← Back to home
              </Link>

              <h2 className="text-[32px] font-black text-white tracking-tight mb-1 font-sans">
                Log in
              </h2>
              <p className="text-xs text-[#7E769B] mb-8 font-light">
                Don't have an account?{" "}
                <button 
                  onClick={() => setIsSignUp(true)} 
                  className="text-[#9664FF] hover:underline font-semibold cursor-pointer"
                >
                  Create an Account
                </button>
              </p>

              <form onSubmit={onSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-[#B3ABC9] uppercase tracking-wider">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full bg-[#140b2a] border border-[#241a42] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#9664FF] transition-all"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#B3ABC9] uppercase tracking-wider">
                      Password
                  </label>
                    <a href="#" className="text-xs text-[#7E769B] hover:text-[#9664FF] transition-colors">
                      Forgot Password?
                    </a>
                  </div>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full bg-[#140b2a] border border-[#241a42] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#9664FF] transition-all"
                    required
                  />
                </div>

                {error ? (
                  <div className="text-xs text-destructive border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 rounded-xl">
                    {error}
                  </div>
                ) : null}

                <button 
                  type="submit" 
                  disabled={pending}
                  className="btn w-full justify-center !mt-4 cursor-pointer"
                >
                  {pending ? "Signing in…" : "Log in"}
                </button>
              </form>

              <div className="mt-8 border-t border-[#241a42] pt-6 text-center">
                <span className="text-[10px] font-mono text-[#7E769B] uppercase tracking-wider">
                  Demo access credentials
                </span>
                <p className="text-[11px] text-[#B3ABC9] mt-1">
                  admin@cosmos.com · admin123
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
