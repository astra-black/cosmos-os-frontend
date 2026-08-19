import { useState, type FormEvent } from "react"
import { Navigate, useNavigate, Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { portalLogin } from "@/lib/api/platform"
import { ApiError } from "@/lib/api/client"

const PORTAL_KEY = "cosmos.portalUser"

export function getPortalUser() {
  try {
    const raw = localStorage.getItem(PORTAL_KEY)
    const user = raw ? JSON.parse(raw) : null
    if (
      !user ||
      user.role !== "client" ||
      typeof user.clientId !== "string" ||
      typeof user.name !== "string"
    ) {
      clearPortalUser()
      return null
    }
    return user
  } catch {
    return null
  }
}

export function clearPortalUser() {
  localStorage.removeItem(PORTAL_KEY)
}

export function PortalLoginPage() {
  const navigate = useNavigate()
  const existing = getPortalUser()
  const [email, setEmail] = useState("elena@northstar.capital")
  const [password, setPassword] = useState("client123")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (existing) return <Navigate to="/portal" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await portalLogin(email, password)
      localStorage.setItem(PORTAL_KEY, JSON.stringify(res.data))
      navigate("/portal", { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="astra-black-theme min-h-screen w-full flex items-center justify-center p-4 bg-[#060110] relative font-sans text-[#EDE9F7] antialiased">
      {/* Dynamic background lights */}
      <div className="glow" aria-hidden="true" />

      {/* Clean centered card window */}
      <div className="w-full max-w-[1020px] bg-[#0d0620]/60 border border-[#241a42] rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-[0_0_80px_rgba(110,40,255,0.15)] backdrop-blur-xl min-h-[620px]">
        
        {/* Left Side: Visual Showcase Banner (VR-inspired high-fidelity illustration) */}
        <div className="w-full md:w-[48%] relative overflow-hidden bg-[#060110] min-h-[300px] md:min-h-auto">
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

        {/* Right Side: Clean Form Console */}
        <div className="flex-1 p-8 md:p-12 flex flex-col justify-center relative bg-[#0d0620]/40">
          {/* Back to landing page */}
          <Link 
            to="/" 
            className="flex items-center gap-1.5 text-xs text-[#7E769B] hover:text-white mb-8 transition-colors"
          >
            ← Back to home
          </Link>

          <div className="max-w-[380px] w-full mx-auto">
            <h2 className="text-[32px] font-black text-white tracking-tight mb-1 font-sans">
              Client Portal
            </h2>
            <p className="text-xs text-[#7E769B] mb-8 font-light">
              External gateway for approvals and shared assets.
            </p>

            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#B3ABC9] uppercase tracking-wider">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#140b2a] border border-[#241a42] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#9664FF] transition-all"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-[#B3ABC9] uppercase tracking-wider">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#140b2a] border border-[#241a42] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#9664FF] transition-all"
                  required
                />
              </div>

              {error ? (
                <div className="text-xs text-[#destructive] border border-[#destructive]/20 bg-[#destructive]/5 px-3.5 py-2.5 rounded-xl">
                  {error}
                </div>
              ) : null}

              <button 
                type="submit" 
                disabled={pending}
                className="btn w-full justify-center !mt-4 cursor-pointer"
              >
                {pending ? "Entering portal…" : "Enter Portal"}
              </button>
            </form>

            <div className="mt-8 border-t border-[#241a42] pt-6 text-center">
              <span className="text-[10px] font-mono text-[#7E769B] uppercase tracking-wider">
                Demo access credentials
              </span>
              <p className="text-[11px] text-[#B3ABC9] mt-1">
                elena@northstar.capital · client123
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
