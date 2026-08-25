import { useState, useEffect, useRef, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { useTheme } from "next-themes"
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Logo } from "@/components/ui/logo"
import { cn } from "@/lib/utils"
import { joinWaitlist } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"

const TOOLS = ["Airtable", "Slack", "Google Sheets", "QuickBooks", "Notion", "HubSpot", "Asana", "Trello", "Zapier", "Stripe", "Jira", "+ 20 more"]
const LOGO_CHIPS = ["Airtable", "Slack", "Google Workspace", "QuickBooks", "Notion"]

type AgentKey = "intake" | "match" | "stage"

const AGENT_LABELS: Record<AgentKey, string> = {
  intake: "Intake Agent",
  match: "Match Agent",
  stage: "Stage Monitor",
}

export function LandingPage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [isStuck, setIsStuck] = useState(false)
  const [queueNumber, setQueueNumber] = useState(0)
  const [waitlistPending, setWaitlistPending] = useState(false)
  const [waitlistError, setWaitlistError] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Chat mockup state
  const [selectedAgent, setSelectedAgent] = useState<AgentKey>("intake")
  const [message, setMessage] = useState("")
  const [focused, setFocused] = useState(false)
  const [customMessages, setCustomMessages] = useState<string[]>([])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const handleScroll = () => setIsStuck(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll)

    observerRef.current = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); observerRef.current?.unobserve(e.target) } }),
      { threshold: 0.12 }
    )
    document.querySelectorAll(".reveal").forEach((el) => observerRef.current?.observe(el))

    return () => { window.removeEventListener("scroll", handleScroll); observerRef.current?.disconnect() }
  }, [])

  async function onSubmitWaitlist(e: FormEvent) {
    e.preventDefault()
    if (!email || !name.trim()) return
    setWaitlistPending(true)
    setWaitlistError(null)
    try {
      const response = await joinWaitlist(name.trim(), email)
      setQueueNumber(response.success && response.data?.queuePosition ? response.data.queuePosition : Math.floor(Math.random() * 200) + 312)
      setSubmitted(true)
    } catch (err) {
      setWaitlistError(err instanceof ApiError ? err.message : "Failed to join waitlist")
    } finally {
      setWaitlistPending(false)
    }
  }

  function sendMessage() {
    const trimmed = message.trim()
    if (!trimmed) return
    setCustomMessages((prev) => [...prev, trimmed])
    setMessage("")
  }

  const effectiveTheme = mounted ? theme : "dark"
  const isDark = effectiveTheme === "dark" || (effectiveTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  const surface = isDark ? "bg-[#0d0620]" : "bg-white"
  const surfaceSoft = isDark ? "bg-[#0d0620]/60" : "bg-[#f5f7fa]"
  const border = isDark ? "border-[#241a42]" : "border-[#E0DCE8]"
  const inkDim = isDark ? "text-[#B3ABC9]" : "text-[#4A4458]"
  const inkFaint = isDark ? "text-[#7E769B]" : "text-[#9aa1ad]"
  const heading = isDark ? "text-white" : "text-[#1A1A2E]"

  return (
    <div className={cn("min-h-screen relative antialiased font-sans", isDark ? "bg-[#060110] text-[#EDE9F7]" : "bg-white text-[#1A1A2E]")}>
      {isDark && <div className="glow" aria-hidden="true" />}

      {/* ── NAV ── */}
      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
        isStuck
          ? cn("py-3 backdrop-blur-xl", isDark ? "bg-[#060110]/85 border-[#241a42]" : "bg-white/85 border-[#E0DCE8]")
          : "py-4 border-transparent"
      )}>
        <div className="max-w-295 mx-auto px-7 flex items-center justify-between">
          <Logo size="md" />
          <div className={cn("hidden md:flex gap-7 text-sm", inkDim)}>
            <a href="#how" className={cn("hover:transition-colors", isDark ? "hover:text-white" : "hover:text-[#1A1A2E]")}>How it works</a>
            <a href="#integrations" className={cn("hover:transition-colors", isDark ? "hover:text-white" : "hover:text-[#1A1A2E]")}>Integrations</a>
            <a href="#log" className={cn("hover:transition-colors", isDark ? "hover:text-white" : "hover:text-[#1A1A2E]")}>Activity</a>
            <a href="#faq" className={cn("hover:transition-colors", isDark ? "hover:text-white" : "hover:text-[#1A1A2E]")}>FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn text-sm">Get Started →</Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        {/* ── HERO ── */}
        <section className="pt-35 pb-16 relative z-10">
          <div className="max-w-295 mx-auto px-7 grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
            <div>
              <span className={cn(
                "inline-flex items-center gap-2 text-[11px] font-mono tracking-wider uppercase px-3 py-1.5 rounded-full mb-5 border",
                isDark ? "text-[#9664FF] bg-[#6E28FF]/10 border-[#6E28FF]/25" : "text-[#6E28FF] bg-[#6E28FF]/8 border-[#6E28FF]/20"
              )}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#6E28FF]" />
                Now in Beta
              </span>
              <h1 className={cn("text-[clamp(34px,4.6vw,52px)] leading-[1.08] font-bold tracking-tight", heading)}>
                Run Your Creative Production on <span className="gradv">Autopilot.</span>
              </h1>
              <p className={cn("mt-5 text-[17px] leading-relaxed max-w-120", inkDim)}>
                Astra Black matches custom databases with secure agentic workflows to autonomously ingest CRM leads, allocate production teams, and audit billing sheets.
              </p>
              <div className="mt-7 max-w-105">
                {submitted ? (
                  <div className={cn("flex items-center gap-3 rounded-xl px-4 py-3 border", border, surfaceSoft)}>
                    <CheckCircle2 className="w-5 h-5 text-[#63D516] shrink-0" />
                    <div>
                      <p className={cn("text-sm font-semibold", heading)}>You're on the list — #{queueNumber}</p>
                      <p className={cn("text-xs", inkFaint)}>We'll reach out as space becomes available.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={onSubmitWaitlist} className="flex flex-col gap-2.5">
                    {waitlistError && (
                      <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-2.5 rounded-xl">{waitlistError}</div>
                    )}
                    <input
                      id="waitlist-name" type="text" placeholder="Your Name" value={name}
                      onChange={(e) => setName(e.target.value)} required disabled={waitlistPending}
                      className={cn("w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#9664FF] transition-all border", border, isDark ? "bg-[#140b2a] text-white" : "bg-white text-[#1A1A2E]")}
                    />
                    <input
                      type="email" placeholder="Work Email Address" value={email}
                      onChange={(e) => setEmail(e.target.value)} required disabled={waitlistPending}
                      className={cn("w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#9664FF] transition-all border", border, isDark ? "bg-[#140b2a] text-white" : "bg-white text-[#1A1A2E]")}
                    />
                    <button type="submit" className="btn w-full justify-center text-[15px]" disabled={waitlistPending}>
                      {waitlistPending ? (<><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>) : (<>Request Invitation <ArrowRight className="w-4 h-4" /></>)}
                    </button>
                    <p className={cn("text-xs mt-1", inkFaint)}>No credit card required. Cancel anytime.</p>
                  </form>
                )}
              </div>
            </div>

            {/* Chat window mockup */}
            <div className={cn("rounded-2xl border overflow-hidden shadow-[0_30px_70px_-34px_rgba(20,23,31,0.22)]", border, surface, "min-h-95")}>
              <div className="grid grid-cols-[150px_1fr] max-sm:grid-cols-1 min-h-95">
                {/* Agent tabs */}
                <div className={cn("border-r p-3 max-sm:hidden", border, surfaceSoft)}>
                  <div className={cn("text-[11px] uppercase tracking-wider px-2 pb-2", inkFaint)}>Agents</div>
                  <div className="space-y-2">
                    {(Object.keys(AGENT_LABELS) as AgentKey[]).map((key) => {
                      const accent = key === "intake" ? (isDark ? "text-[#CAB2FD]" : "text-[#6E28FF]")
                        : key === "match" ? (isDark ? "text-[#63D516]" : "text-[#6E28FF]")
                        : (isDark ? "text-[#FF05E6]" : "text-[#6E28FF]")
                      return (
                        <button
                          key={key}
                          type="button"
                          className={cn(
                            "w-full text-left p-2 rounded-lg text-sm font-medium transition-colors hover:bg-[#6E28FF]/10 focus:outline-none focus:ring-2 focus:ring-[#6E28FF]/20",
                            accent,
                            selectedAgent === key ? "bg-[#6E28FF]/10" : "bg-transparent"
                          )}
                          onClick={() => setSelectedAgent(key)}
                        >
                          <span className="font-semibold">{AGENT_LABELS[key]}</span>
                          <span className="text-xs text-[#7E769B] block">
                            {key === "intake" ? "New lead processed…" : key === "match" ? "3 vendors matched…" : "All cues green…"}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                {/* Conversation area */}
                <div className="flex flex-col overflow-y-auto p-4">
                  {/* Agent header shows current selection */}
                  <div className={cn("flex items-center gap-2.5 px-4 py-3 border-b text-[13px] font-semibold", border)}>
                    <span className="w-6 h-6 rounded-md bg-[#6E28FF] flex items-center justify-center text-white text-xs">A</span>
                    <span className="font-medium">{AGENT_LABELS[selectedAgent]}</span>
                  </div>

                  {/* Conversation messages */}
                  <div className="flex-1 space-y-3 py-3">
                    {selectedAgent === "intake" && (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-md bg-[#6E28FF] flex items-center justify-center text-white text-sm font-medium">A</div>
                          <div className="self-start max-w-[80%] px-3.5 py-2.5 rounded-xl text-[13.5px] leading-relaxed bg-[#140b2a] text-white">
                            New CRM lead from Acme Corp — annual gala, 200 guests. Should I create the project card and assign the intake checklist?
                          </div>
                        </div>
                        <div className="flex items-end gap-3 justify-end">
                          <div className="max-w-[80%] px-3.5 py-2.5 rounded-xl text-[13.5px] leading-relaxed bg-[#6E28FF]/8 border border-[#6E28FF]/15">
                            Yes, proceed. Also flag their preferred vendor list from last year's event.
                          </div>
                        </div>
                      </>
                    )}

                    {customMessages.map((msg, i) => (
                      <div key={i} className="flex items-end gap-3 justify-end">
                        <div className="max-w-[80%] px-3.5 py-2.5 rounded-xl text-[13.5px] leading-relaxed bg-[#6E28FF]/8 border border-[#6E28FF]/15">
                          {msg}
                        </div>
                        <div className="w-10 h-10 rounded-md bg-[#6E28FF] flex items-center justify-center text-white text-sm font-medium shrink-0">A</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Message input at bottom */}
              <div className={cn("px-4 py-3 border-t", border)}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type a message…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendMessage() }}
                    className={cn(
                      "flex-1 rounded-xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6E28FF]/20 transition-colors",
                      border, isDark ? "bg-[#140b2a] text-white" : "bg-white text-[#1A1A2E]"
                    )}
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    className={cn(
                      "rounded-xl bg-[#6E28FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#9664FF] transition-colors disabled:opacity-50",
                      focused ? "bg-[#9664FF]" : ""
                    )}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── LOGO STRIP ── */}
        <section className={cn("border-y py-6", border)}>
          <div className="max-w-295 mx-auto px-7 flex items-center justify-between gap-8 flex-wrap">
            <span className={cn("text-xs whitespace-nowrap", inkFaint)}>Works with the tools you already use</span>
            <div className="flex gap-3 flex-wrap">
              {LOGO_CHIPS.map((t) => (
                <span key={t} className={cn("font-mono text-xs px-3 py-1.5 rounded-md border", border, isDark ? "bg-[#140b2a] text-[#B3ABC9]" : "bg-[#f5f7fa] text-[#5b6270]")}>{t}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how" className="py-20">
          <div className="max-w-295 mx-auto px-7">
            <div className="max-w-150 mb-11 reveal">
              <span className="eyebrow"><span>How it works</span></span>
              <h2 className={cn("text-[clamp(26px,3.2vw,36px)] font-bold mt-3 tracking-tight", heading)}>Get up and running in minutes</h2>
              <p className={cn("mt-3.5 text-base", inkDim)}>Connect your data, let agents learn your operations, and start asking questions in plain language.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 reveal">
              {/* Step 1 */}
              <div className={cn("rounded-2xl border p-6", border, surface)}>
                <div className="font-mono text-xs text-[#6E28FF] mb-3.5">STEP 1 / 3</div>
                <h3 className={cn("text-[17px] font-semibold mb-2", heading)}>Connect your accounts</h3>
                <p className={cn("text-sm leading-relaxed", inkDim)}>Link your CRM, databases, and project tools. Read-only access to start — no data moves without approval.</p>
                <div className={cn("mt-4 rounded-xl border overflow-hidden", border, surfaceSoft)}>
                  <div className={cn("flex justify-between px-3 py-2 text-xs border-b", border, inkFaint)}>
                    <span>Accounts</span><span>3/5 connected</span>
                  </div>
                  {[["Airtable", true], ["Slack", true], ["QuickBooks", false]].map(([tool, done]) => (
                    <div key={tool as string} className={cn("flex items-center justify-between px-3 py-2 text-xs border-t", border)}>
                      <span className={cn("flex items-center gap-2 font-medium", heading)}>
                        <span className={cn("w-2 h-2 rounded-sm", done ? "bg-[#63D516]" : "bg-[#7E769B]")} />
                        {tool as string}
                      </span>
                      <span className={cn(
                        "font-mono text-[11px] px-2.5 py-1 rounded-md border",
                        done
                          ? "text-[#1f9d5c] border-[#1f9d5c]/30 bg-[#1f9d5c]/8"
                          : cn(border, surface)
                      )}>
                        {done ? "Connected" : "Connect"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 2 */}
              <div className={cn("rounded-2xl border p-6", border, surface)}>
                <div className="font-mono text-xs text-[#6E28FF] mb-3.5">STEP 2 / 3</div>
                <h3 className={cn("text-[17px] font-semibold mb-2", heading)}>Agents build your model</h3>
                <p className={cn("text-sm leading-relaxed", inkDim)}>Our agents index your records, learn your workflows, and map relationships across your data sources.</p>
                <div className={cn("mt-4 rounded-xl border h-37.5 relative", border, surfaceSoft)}>
                  <div className="absolute w-3 h-3 rounded-full bg-[#6E28FF] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                  {[[20, 25], [30, 75], [70, 20], [75, 70], [15, 60]].map(([t, l], i) => (
                    <div key={i} className="absolute w-2 h-2 rounded-full bg-[#6E28FF]/60" style={{ top: `${t}%`, left: `${l}%` }} />
                  ))}
                  <div className={cn("absolute bottom-2 left-3 font-mono text-[10.5px]", inkFaint)}>247 records linked</div>
                </div>
              </div>

              {/* Step 3 */}
              <div className={cn("rounded-2xl border p-6", border, surface)}>
                <div className="font-mono text-xs text-[#6E28FF] mb-3.5">STEP 3 / 3</div>
                <h3 className={cn("text-[17px] font-semibold mb-2", heading)}>Ask, in plain language</h3>
                <p className={cn("text-sm leading-relaxed", inkDim)}>Query your agents naturally or let them run autonomously on schedules you define.</p>
                <div className={cn("mt-4 rounded-xl border overflow-hidden", border, surfaceSoft)}>
                  <div className={cn("flex justify-between px-3 py-2 text-xs border-b", border, inkFaint)}>
                    <span>Example ask</span><span>answered</span>
                  </div>
                  <div className={cn("flex items-center justify-between px-3 py-2 text-xs", border)}>
                    <span className={cn("font-medium", heading)}>"Who's available for the Acme shoot next Tuesday?"</span>
                    <span className="text-[#1f9d5c] font-mono text-[11px]">✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── DARK TERMINAL STRIP ── */}
        <section id="log" className={cn("py-20", isDark ? "bg-[#060110]" : "bg-[#12141a]")}>
          <div className="max-w-295 mx-auto px-7">
            <div className="max-w-150 mb-11 reveal">
              <span className="eyebrow" style={{ color: "#7fa6ff" }}><span>Activity</span></span>
              <h2 className="text-[clamp(26px,3.2vw,36px)] font-bold mt-3 tracking-tight text-white">Every action, fully auditable</h2>
              <p className="mt-3.5 text-base text-[#8b909c]">Every agent action is logged with timestamps, record IDs, and rollback capability. Nothing runs in the dark.</p>
            </div>
            <div className="rounded-2xl border border-[#262a33] bg-[#0d0f14] overflow-hidden reveal">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#262a33]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2a2e38]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#2a2e38]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#2a2e38]" />
              </div>
              <div className="py-4">
                {[
                  { t: "09:12:04", s: "ok", m: "IntakeAgent parsed lead #4821 — Acme Corp annual gala" },
                  { t: "09:14:41", s: "ok", m: "MatchAgent assigned 3 vendors to project PRJ-0092" },
                  { t: "09:19:02", s: "warn", m: "BillingAudit flagged timesheet anomaly on invoice #INV-3301" },
                  { t: "09:26:57", s: "ok", m: "StageMonitor confirmed all cues green for Event EVT-0048" },
                ].map((line, i) => (
                  <div key={i} className="font-mono text-xs px-4 py-1.5 flex gap-2.5 text-[#8b909c]">
                    <span className="text-[#565b66]">{line.t}</span>
                    <span className={line.s === "ok" ? "text-[#57d18a]" : "text-[#f2a94f]"}>{line.s === "ok" ? "✓" : "!"}</span>
                    <span>{line.m}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── INTEGRATIONS GRID ── */}
        <section id="integrations" className="py-20">
          <div className="max-w-295 mx-auto px-7">
            <div className="max-w-150 mb-11 reveal">
              <span className="eyebrow"><span>Integrations</span></span>
              <h2 className={cn("text-[clamp(26px,3.2vw,36px)] font-bold mt-3 tracking-tight", heading)}>Connects to your entire stack</h2>
              <p className={cn("mt-3.5 text-base", inkDim)}>Plug into the tools your agency already runs on — databases, project management, finance, and communication.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 reveal">
              {TOOLS.map((t, i) => (
                <div key={i} className={cn(
                  "border rounded-lg px-2.5 py-4 text-center text-[13px] transition-colors",
                  border, surface, inkDim,
                  "hover:border-[#6E28FF] hover:text-foreground"
                )}>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="py-20">
          <div className="max-w-295 mx-auto px-7">
            <div className="max-w-150 mb-11 reveal">
              <span className="eyebrow"><span>FAQ</span></span>
              <h2 className={cn("text-[clamp(26px,3.2vw,36px)] font-bold mt-3 tracking-tight", heading)}>Frequently Asked Questions</h2>
            </div>
            <div className="flex flex-col gap-4 reveal max-w-200">
              {[
                { q: "How does the core data synchronization work?", a: "Astra Black integrates directly with your enterprise databases and APIs. Agents monitor records, execute task logic in secure middleware, and sync updates back to your source tables in real time." },
                { q: "Are the background agents fully autonomous?", a: "Agents monitor modifications, structure briefs, and draft recommendations autonomously. Crucial system writes are always verified and deterministic to ensure database safety." },
                { q: "What is the client portal for?", a: "The client portal is a secure external interface where agency clients can review task logs, check shared assets, and approve or request changes on deliverable milestones." },
              ].map((faq, i) => (
                <div key={i} className={cn("rounded-2xl border p-5", border, surface)}>
                  <h4 className={cn("text-[15px] font-semibold mb-2", heading)}>{faq.q}</h4>
                  <p className={cn("text-sm leading-relaxed", inkDim)}>{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CLOSING CTA + WAITLIST ── */}
        <section id="waitlist" className="py-20">
          <div className="max-w-295 mx-auto px-7 text-center flex flex-col items-center reveal">
            <span className="eyebrow justify-center"><span>Get Started</span></span>
            <h2 className={cn("text-[clamp(28px,4vw,44px)] font-bold mt-4 mb-4 max-w-170 leading-[1.15] tracking-tight", heading)}>
              Supercharge your agency database
            </h2>
            <p className={cn("max-w-115 mb-8", inkDim)}>Deploy specialized agent workflows on top of your existing databases today.</p>

            <div className={cn(
              "w-full max-w-120 rounded-2xl p-6 md:p-8 text-left border",
              border, isDark ? "bg-[#0d0620]/60 backdrop-blur-lg" : "bg-white shadow-[0_0_30px_rgba(110,40,255,0.08)]"
            )}>
              {submitted ? (
                <div className="flex flex-col items-center text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-[#63D516]/10 border border-[#63D516]/30 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-6 h-6 text-[#63D516]" />
                  </div>
                  <h3 className={cn("font-bold text-lg mb-2", heading)}>You're on the list</h3>
                  <p className={cn("text-sm mb-6", inkDim)}>Thank you for signing up. We'll reach out as space becomes available.</p>
                  <div className={cn("px-6 py-3.5 rounded-xl border", border, surfaceSoft)}>
                    <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-[#9664FF]">Your Queue Position</span>
                    <span className={cn("text-2xl font-black tracking-tight", heading)}>#{queueNumber}</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={onSubmitWaitlist} className="flex flex-col gap-4">
                  <div>
                    <h3 className={cn("font-bold text-[15px] mb-1", heading)}>Join the Private Waitlist</h3>
                    <p className={cn("text-xs", inkFaint)}>Get early access to agentic agency workflows.</p>
                  </div>
                  {waitlistError && (
                    <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-xl">{waitlistError}</div>
                  )}
                  <input
                    id="waitlist-name" type="text" placeholder="Your Name" value={name}
                    onChange={(e) => setName(e.target.value)} required disabled={waitlistPending}
                    className={cn("w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#9664FF] transition-all border", border, isDark ? "bg-[#140b2a] text-white" : "bg-white text-[#1A1A2E]")}
                  />
                  <input
                    type="email" placeholder="Work Email Address" value={email}
                    onChange={(e) => setEmail(e.target.value)} required disabled={waitlistPending}
                    className={cn("w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#9664FF] transition-all border", border, isDark ? "bg-[#140b2a] text-white" : "bg-white text-[#1A1A2E]")}
                  />
                  <button type="submit" className="btn w-full justify-center" disabled={waitlistPending}>
                    {waitlistPending ? (<><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>) : (<>Request Invitation <ArrowRight className="w-4 h-4" /></>)}
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className={cn("border-t py-9 relative z-10", border)}>
        <div className="max-w-295 mx-auto px-7 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <Logo size="sm" />
            <p className={cn("text-[11px]", inkFaint)}>© 2026 Astra Black. All rights reserved.</p>
          </div>
          <div className={cn("flex gap-5 text-xs", inkFaint)}>
            <a href="#how" className={cn("hover:transition-colors", isDark ? "hover:text-white" : "hover:text-[#1A1A2E]")}>How it works</a>
            <a href="#integrations" className={cn("hover:transition-colors", isDark ? "hover:text-white" : "hover:text-[#1A1A2E]")}>Integrations</a>
            <a href="#" className={cn("hover:transition-colors", isDark ? "hover:text-white" : "hover:text-[#1A1A2E]")}>Terms</a>
            <a href="#" className={cn("hover:transition-colors", isDark ? "hover:text-white" : "hover:text-[#1A1A2E]")}>Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  )
}