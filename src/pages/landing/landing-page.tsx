import { useState, useEffect, useRef, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { useTheme } from "next-themes"
import { ArrowRight, ArrowUp, CheckCircle2, Loader2, Inbox, Search, ShieldCheck, Sparkles } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Logo } from "@/components/ui/logo"
import { cn } from "@/lib/utils"
import { joinWaitlist } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"

const TOOLS = ["Airtable", "Make", "HubSpot", "Asana", "Apollo", "Lindy", "Bizzabo", "Shoflo", "Fillout", "Slack", "Google Sheets", "+ 3 more"]
const LOGO_CHIPS = ["Airtable", "HubSpot", "Slack", "Google Sheets", "Adobe CC"]

type AgentKey = "intake" | "match" | "stage"

const AGENT_LABELS: Record<AgentKey, string> = {
  intake: "Intake Agent",
  match: "Vendor Intelligence",
  stage: "Conflict Detector",
}
const AGENT_META: Record<AgentKey, { icon: typeof Inbox; status: string }> = {
  intake: { icon: Inbox, status: "New event intake processed…" },
  match: { icon: Search, status: "3 vendors matched, ranked by fit…" },
  stage: { icon: ShieldCheck, status: "No scheduling conflicts detected…" },
}

const SEED_CONVERSATIONS: Record<AgentKey, { from: "agent" | "user"; text: string; time: string }[]> = {
  intake: [
    { from: "agent", time: "Just now", text: "New CRM lead from Lumen & Co. — brand activation, 400 guests. Should I create the project card, assign the intake checklist, and pull their preferred vendor list from last year?" },
    { from: "user", time: "Just now", text: "Yes, proceed — and flag if any of those vendors are already booked that week." },
  ],
  match: [
    { from: "agent", time: "Just now", text: "Found 3 vendors for the Lumen & Co. AV package — Apex Sound ($4,200 · 4.9★), StageWorks ($3,850 · 4.7★), Nova Rentals ($4,600 · 4.8★). Want me to send outreach to the top two?" },
    { from: "user", time: "Just now", text: "Send to Apex and StageWorks — CC me on both." },
  ],
  stage: [
    { from: "agent", time: "Just now", text: "Checked every cue for Event EVT-0048 — no scheduling conflicts, all vendors confirmed, crew fully staffed for load-in." },
    { from: "user", time: "Just now", text: "Perfect — lock the timeline and notify the crew." },
  ],
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
                One Platform · Infinite Verticals
              </span>
              <h1 className={cn("text-[clamp(34px,4.6vw,52px)] leading-[1.08] font-bold tracking-tight", heading)}>
                Where Star Power Becomes <span className="gradv">Structured Power.</span>
              </h1>
              <p className={cn("mt-5 text-[17px] leading-relaxed max-w-120", inkDim)}>
                Astra Black Cosmos is the single home for creative and experiential organizations — every relationship, project, vendor, and creative asset living in one place, purpose-built for your vertical. No more switching between a dozen tools that were never built for how creative work actually happens.
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
                    <p className={cn("text-xs mt-1", inkFaint)}>No credit card required. We'll email you when your invite is ready.</p>
                  </form>
                )}
              </div>
            </div>

            {/* Chat window mockup */}
            {/* Chat window mockup */}
            <div className={cn("rounded-2xl border overflow-hidden shadow-[0_30px_70px_-34px_rgba(20,23,31,0.22)]", border, surface, "min-h-95")}>
              <div className="grid grid-cols-[172px_1fr] max-sm:grid-cols-1 min-h-95">
                {/* Agent tabs */}
                <div className={cn("border-r p-3 max-sm:hidden", border, surfaceSoft)}>
                  <div className="flex items-center justify-between px-2 pb-3">
                    <span className={cn("text-[11px] uppercase tracking-wider font-medium", inkFaint)}>Agents</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#57d18a]">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#57d18a] opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#57d18a]" />
                      </span>
                      Live
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {(Object.keys(AGENT_LABELS) as AgentKey[]).map((key) => {
                      const { icon: Icon, status } = AGENT_META[key]
                      const isSelected = selectedAgent === key
                      return (
                        <button
                          key={key}
                          type="button"
                          className={cn(
                            "group relative w-full text-left pl-3.5 pr-2.5 py-2.5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#6E28FF]/20",
                            isSelected ? cn(surface, "shadow-[0_2px_14px_-4px_rgba(110,40,255,0.3)]") : "hover:bg-[#6E28FF]/[0.06]"
                          )}
                          onClick={() => setSelectedAgent(key)}
                        >
                          {isSelected && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[55%] w-[3px] rounded-full bg-[#6E28FF]" />
                          )}
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "flex items-center justify-center w-6 h-6 rounded-lg shrink-0 transition-colors duration-200",
                              isSelected ? "bg-[#6E28FF] text-white" : cn(surfaceSoft, isDark ? "text-[#B3ABC9]" : "text-[#6E28FF]")
                            )}>
                              <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                            </span>
                            <span className={cn("font-semibold text-[13px] truncate transition-colors duration-200", isSelected ? heading : inkDim)}>
                              {AGENT_LABELS[key]}
                            </span>
                          </div>
                          <span className={cn("text-[11px] block mt-1 pl-8 truncate", inkFaint)}>
                            {status}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Conversation area */}
                <div className="flex flex-col h-full">
                  {/* Agent header shows current selection */}
                  <div className={cn("flex items-center justify-between gap-2.5 px-4 py-3 border-b shrink-0", border)}>
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#6E28FF] text-white shrink-0">
                        {(() => { const Icon = AGENT_META[selectedAgent].icon; return <Icon className="w-3.5 h-3.5" strokeWidth={2.25} /> })()}
                      </span>
                      <span className={cn("text-[13px] font-semibold", heading)}>{AGENT_LABELS[selectedAgent]}</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-[#57d18a]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#57d18a]" />
                      Active
                    </span>
                  </div>

                  {/* Conversation messages */}
                  <div className="flex-1 overflow-y-auto space-y-4 px-4 py-4">
                    {SEED_CONVERSATIONS[selectedAgent].map((msg, i) => {
                      const Icon = AGENT_META[selectedAgent].icon
                      return msg.from === "agent" ? (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#6E28FF] text-white shrink-0 mt-0.5">
                            <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
                          </span>
                          <div className="max-w-[82%]">
                            <div className={cn("px-3.5 py-2.5 rounded-2xl rounded-tl-sm text-[13.5px] leading-relaxed", isDark ? "bg-[#140b2a] text-white" : "bg-[#f5f7fa] text-[#1A1A2E]")}>
                              {msg.text}
                            </div>
                            <span className={cn("text-[10.5px] mt-1 block", inkFaint)}>{msg.time}</span>
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="flex flex-col items-end">
                          <div className="max-w-[82%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-[13.5px] leading-relaxed bg-[#6E28FF] text-white">
                            {msg.text}
                          </div>
                          <span className={cn("text-[10.5px] mt-1", inkFaint)}>{msg.time}</span>
                        </div>
                      )
                    })}

                    {customMessages.map((msg, i) => (
                      <div key={`custom-${i}`} className="flex flex-col items-end">
                        <div className="max-w-[82%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-[13.5px] leading-relaxed bg-[#6E28FF] text-white">
                          {msg}
                        </div>
                        <span className={cn("text-[10.5px] mt-1", inkFaint)}>Just now</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Message input at bottom */}
              <div className={cn("px-4 py-3 border-t", border)}>
                <div className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 transition-colors duration-200",
                  focused ? "border-[#9664FF] ring-2 ring-[#6E28FF]/15" : border,
                  isDark ? "bg-[#140b2a]" : "bg-white"
                )}>
                  <Sparkles className={cn("w-4 h-4 shrink-0", isDark ? "text-[#7E769B]" : "text-[#9aa1ad]")} />
                  <input
                    type="text"
                    placeholder="Ask any agent anything…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    onKeyDown={(e) => { if (e.key === "Enter") sendMessage() }}
                    className={cn("flex-1 bg-transparent py-2.5 text-sm focus:outline-none", isDark ? "text-white placeholder:text-[#7E769B]" : "text-[#1A1A2E] placeholder:text-[#9aa1ad]")}
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-all duration-200 disabled:cursor-not-allowed",
                      message.trim() ? "bg-[#6E28FF] hover:bg-[#9664FF]" : surfaceSoft
                    )}
                  >
                    <ArrowUp className={cn("w-4 h-4", message.trim() ? "text-white" : inkFaint)} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── LOGO STRIP ── */}
        <section className={cn("border-y py-6", border)}>
          <div className="max-w-295 mx-auto px-7 flex items-center justify-between gap-8 flex-wrap">
            <span className={cn("text-xs whitespace-nowrap", inkFaint)}>The fragmented stack most creative teams run today — Cosmos replaces it</span>
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
              <p className={cn("mt-3.5 text-base", inkDim)}>Connect your existing tools, let Cosmos agents learn how your organization operates, and move everything — relationships, projects, vendors, assets — into the one home it should have always had.</p>
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
                  {[["Airtable", true], ["Slack", true], ["HubSpot", false]].map(([tool, done]) => (
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
                    <span className={cn("font-medium", heading)}>"Which vendors are free for the Acme shoot next Tuesday?"</span>
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
                  { t: "09:12:04", s: "ok", m: "Vendor Intelligence Agent sourced 3 vendors for PRJ-0092 — ranked by price and rating" },
                  { t: "09:14:41", s: "ok", m: "Campaign Timeline Generator built a 14-step plan from the Lumen & Co. brief" },
                  { t: "09:19:02", s: "warn", m: "Financial Anomaly Detector flagged an over-budget line item on invoice #INV-3301" },
                  { t: "09:26:57", s: "ok", m: "Run of Show Conflict Detector cleared all cues for Event EVT-0048 — no conflicts found" },
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
              <span className="eyebrow"><span>The stack we replace</span></span>
              <h2 className={cn("text-[clamp(26px,3.2vw,36px)] font-bold mt-3 tracking-tight", heading)}>One home, instead of a dozen tools</h2>
              <p className={cn("mt-3.5 text-base", inkDim)}>The average creative agency manages 7–12 disconnected tools costing $20K+ a year. Cosmos becomes the single home where relationships, projects, vendors, finances, and AI agents all live — instead of scattered across a dozen apps that were never built for creative work.</p>
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
                { q: "How is Cosmos different from Airtable, Bizzabo, or Adobe?", a: "Those platforms each solve one piece — Airtable is a database, Bizzabo handles event logistics, Adobe covers creative tools. None of them understand entertainment operations end to end. Cosmos is the only platform merging relationship intelligence, production management, vendor AI, and creative operations into one purpose-built system — replacing the 7-plus tools most agencies stitch together today." },
                { q: "What does pricing look like?", a: "Individual and Professional plans start free, with paid tiers from $49 to $249/month for solo operators and boutique studios. Business and Agency plans run $99 to $499 per seat per month, billed annually, and include full AI agent access. Enterprise and white-label pricing is scoped directly with our team." },
                { q: "Are the AI agents actually doing work, or just organizing it?", a: "They do the work. Vendor sourcing, timeline generation, conflict detection, budget monitoring, and outreach follow-up all run through dedicated agents built for each OS edition — not a chatbot layered on top of a database. Every agent action is logged and auditable." },
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
              The single home for your entire organization
            </h2>
            <p className={cn("max-w-115 mb-8", inkDim)}>Join the waitlist for Agency OS, Run of Show OS, and Artist OS — the first purpose-built editions of the one platform every creative organization will call home.</p>

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
                    <p className={cn("text-xs", inkFaint)}>Get early access as new Cosmos editions launch — starting with Agency OS.</p>
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