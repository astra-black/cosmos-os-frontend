import { useState, useEffect, useRef, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { 
  CheckCircle2, 
  ArrowRight, 
  ShieldAlert, 
  Users, 
  Play, 
  DollarSign, 
  Cpu, 
  ChevronDown, 
  HelpCircle,
  Clock,
  Layers,
  Sparkles
} from "lucide-react"

export function LandingPage() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [isStuck, setIsStuck] = useState(false)
  const [queueNumber, setQueueNumber] = useState(0)

  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    // Scroll Stuck state for header
    const handleScroll = () => {
      setIsStuck(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)

    // Intersection Observer for scroll animations (.rev -> .rev.in)
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in")
          }
        });
      },
      { threshold: 0.05 }
    )

    const animatedElements = document.querySelectorAll(".rev")
    animatedElements.forEach((el) => observerRef.current?.observe(el))

    return () => {
      window.removeEventListener("scroll", handleScroll)
      observerRef.current?.disconnect()
    }
  }, [])

  function onSubmitWaitlist(e: FormEvent) {
    e.preventDefault()
    if (!email) return
    const mockQueueNum = Math.floor(Math.random() * 200) + 312
    setQueueNumber(mockQueueNum)
    setSubmitted(true)
  }

  return (
    <div className="astra-black-theme min-h-screen relative text-[#EDE9F7] antialiased">
      {/* Background glow overlay */}
      <div className="glow" aria-hidden="true" />

      {/* Navigation Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 py-6 px-4 md:px-8 border-b border-transparent ${isStuck ? "bg-[#060110]/80 backdrop-blur-xl py-4 border-[#241a42]" : ""}`}>
        <div className="max-w-[1080px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-extrabold tracking-[0.25em] text-white text-lg font-sans">
              ASTRA<span className="text-[#CAB2FD]">BLACK</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to="/portal/login" 
              className="text-[11px] font-extrabold tracking-wider text-[#9664FF] uppercase border border-[#241a42] hover:border-[#9664FF] hover:bg-[#9664FF]/5 px-4.5 py-2.5 rounded-xl transition-all duration-300"
            >
              Portal Login
            </Link>
            <Link 
              to="/login" 
              className="text-[11px] font-extrabold tracking-wider text-white bg-gradient-to-r from-[#6E28FF] to-[#5D0FFF] hover:shadow-[0_0_20px_rgba(110,40,255,0.4)] px-5 py-2.5 rounded-xl transition-all duration-300 transform hover:-translate-y-px"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section (Centered Stack) */}
      <section className="pt-[160px] pb-[100px] text-center relative z-10">
        <div className="wrap flex flex-col items-center">
          <div className="eyebrow mb-6 justify-center">
            <span>Deploy Autonomous Agency OS</span>
          </div>
          
          <h1 className="text-clamp-[42px,6.6vw,74px] font-black text-white leading-[1.06] mb-6 font-sans tracking-tight max-w-[850px]">
            Run Your Creative Production on <span className="gradv">Autopilot.</span>
          </h1>
          
          <p className="text-[16px] md:text-[17.5px] font-light text-[#B3ABC9] leading-[1.7] max-w-[620px] mb-12">
            Astra Black matches creative databases with secure agentic workflows to autonomously ingest CRM leads, allocate production teams, check-in crew, and audit Timesheets.
          </p>

          {/* Waitlist Subscription Card */}
          <div className="w-full max-w-[500px] bg-[#0d0620]/60 border border-[#241a42] rounded-2xl p-6 md:p-8 backdrop-blur-lg shadow-[0_0_50px_rgba(110,40,255,0.15)] relative overflow-hidden text-left mb-6">
            {submitted ? (
              <div className="flex flex-col items-center justify-center text-center py-6">
                <div className="w-12 h-12 rounded-full bg-[#63D516]/10 border border-[#63D516]/30 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-6 h-6 text-[#63D516]" />
                </div>
                <h3 className="text-white font-extrabold text-lg mb-2">You're on the list</h3>
                <p className="text-sm text-[#B3ABC9] mb-6">
                  Thank you for signing up. We'll reach out as space becomes available.
                </p>
                <div className="bg-[#140b2a] border border-[#241a42] px-6 py-3.5 rounded-xl">
                  <span className="text-[10px] font-extrabold text-[#CAB2FD] uppercase tracking-wider block mb-1">
                    Your Queue Position
                  </span>
                  <span className="text-2xl font-black text-white tracking-tight">
                    #{queueNumber}
                  </span>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmitWaitlist} className="flex flex-col gap-4">
                <div>
                  <h3 className="text-white font-extrabold text-[15px] mb-1">Join the Private Waitlist</h3>
                  <p className="text-[12px] text-[#7E769B]">Get early access to agentic agency workflows.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <input 
                    type="text" 
                    placeholder="Your Name" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#140b2a] border border-[#241a42] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#9664FF] transition-all"
                    required
                  />
                  <input 
                    type="email" 
                    placeholder="Work Email Address" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#140b2a] border border-[#241a42] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#9664FF] transition-all"
                    required
                  />
                </div>
                <button type="submit" className="btn w-full justify-center !mt-1">
                  Request Invitation <ArrowRight className="ml-2 w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Challenges Section (Clean Vertical List Layout) */}
      <section id="challenges" className="sect">
        <div className="wrap">
          <div className="head rev mb-12">
            <div className="eyebrow mb-4"><span>Operational Friction</span></div>
            <h2 className="text-[30px] md:text-[44px] font-extrabold text-white leading-[1.15] tracking-tight">
              Why traditional agencies scale hard
            </h2>
          </div>

          <div className="flex flex-col gap-5">
            {/* Challenge item 1 */}
            <div className="card p1 flex flex-col md:flex-row gap-6 items-start">
              <div className="ico"><ShieldAlert /></div>
              <div className="flex-1">
                <h3 className="text-white text-[17px] font-bold mb-2">Lead Leakage</h3>
                <p className="text-[13.8px] font-light text-[#B3ABC9] leading-[1.6]">
                  Valuable CRM opportunities sit stale, lacking timely follow-ups or dynamic qualification insights because project setup and customer logging are manual.
                </p>
              </div>
            </div>

            {/* Challenge item 2 */}
            <div className="card p2 flex flex-col md:flex-row gap-6 items-start">
              <div className="ico"><Users /></div>
              <div className="flex-1">
                <h3 className="text-white text-[17px] font-bold mb-2">Vendor Misalignment</h3>
                <p className="text-[13.8px] font-light text-[#B3ABC9] leading-[1.6]">
                  Manually matching vendor profiles to creative tasks consumes hours of project management time, causing delays in resource allocation and contractor sourcing.
                </p>
              </div>
            </div>

            {/* Challenge item 3 */}
            <div className="card p3 flex flex-col md:flex-row gap-6 items-start">
              <div className="ico"><Play /></div>
              <div className="flex-1">
                <h3 className="text-white text-[17px] font-bold mb-2">Show-Day Chaos</h3>
                <p className="text-[13.8px] font-light text-[#B3ABC9] leading-[1.6]">
                  Live crew show events rely on voice-based cue calls. Minor communication breakdowns cause cascade errors, delayed check-ins, and untracked venue incidents.
                </p>
              </div>
            </div>

            {/* Challenge item 4 */}
            <div className="card p4 flex flex-col md:flex-row gap-6 items-start">
              <div className="ico"><DollarSign /></div>
              <div className="flex-1">
                <h3 className="text-white text-[17px] font-bold mb-2">Billing Latency</h3>
                <p className="text-[13.8px] font-light text-[#B3ABC9] leading-[1.6]">
                  Calculating delivery billing milestones manually lags weeks behind work completion, straining agency cashflows and delaying vendor settlements.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agents Section (Vertical Stacked Cards) */}
      <section id="agents" className="sect">
        <div className="wrap">
          <div className="head rev mb-12">
            <div className="eyebrow mb-4"><span>AI Orchestration</span></div>
            <h2 className="text-[30px] md:text-[44px] font-extrabold text-white leading-[1.15] tracking-tight">
              Our Autonomous Agents
            </h2>
          </div>

          <div className="flex flex-col gap-6">
            {/* Agent 1 */}
            <div className="agent a1 flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <span className="text-[10px] font-extrabold tracking-wider text-[#0088FF] uppercase block mb-1">CRM Integration</span>
                <h3 className="text-white text-[18px] font-extrabold mb-2">Intake Specialist</h3>
                <p className="text-[13.8px] font-light text-[#B3ABC9] leading-relaxed">
                  Reads inbound leads from CRM pipelines, creates database project cards, structures client information, and deploys kickoff documents autonomously.
                </p>
              </div>
              <div className="flex md:flex-col justify-between items-end gap-3 mt-4 md:mt-0 self-stretch md:self-auto">
                <span className="text-[10px] font-mono text-[#7E769B]">Service: IntakeAgent</span>
                <span className="try">Active</span>
              </div>
            </div>

            {/* Agent 2 */}
            <div className="agent a2 flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <span className="text-[10px] font-extrabold tracking-wider text-[#63D516] uppercase block mb-1">Resource Coordinator</span>
                <h3 className="text-white text-[18px] font-extrabold mb-2">Matchmaker Agent</h3>
                <p className="text-[13.8px] font-light text-[#B3ABC9] leading-relaxed">
                  Scans vendor lists, filters availability, cross-references task requirements, and registers suitable production profiles for project assignment.
                </p>
              </div>
              <div className="flex md:flex-col justify-between items-end gap-3 mt-4 md:mt-0 self-stretch md:self-auto">
                <span className="text-[10px] font-mono text-[#7E769B]">Service: MatchAgent</span>
                <span className="try">Active</span>
              </div>
            </div>

            {/* Agent 3 */}
            <div className="agent a3 flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <span className="text-[10px] font-extrabold tracking-wider text-[#FF9500] uppercase block mb-1">Stage Director</span>
                <h3 className="text-white text-[18px] font-extrabold mb-2">Incidents Monitor</h3>
                <p className="text-[13.8px] font-light text-[#B3ABC9] leading-relaxed">
                  Subscribes to stage execution cue boards, checks-in stagehands, registers real-time delays, and creates incident resolution tickets instantly.
                </p>
              </div>
              <div className="flex md:flex-col justify-between items-end gap-3 mt-4 md:mt-0 self-stretch md:self-auto">
                <span className="text-[10px] font-mono text-[#7E769B]">Service: StageMonitor</span>
                <span className="try">Active</span>
              </div>
            </div>

            {/* Agent 4 */}
            <div className="agent a4 flex flex-col md:flex-row gap-6 items-start">
              <div className="flex-1">
                <span className="text-[10px] font-extrabold tracking-wider text-[#FF05E6] uppercase block mb-1">Finance Specialist</span>
                <h3 className="text-white text-[18px] font-extrabold mb-2">Billing Auditor</h3>
                <p className="text-[13.8px] font-light text-[#B3ABC9] leading-relaxed">
                  Validates vendor hours against budget estimates, flags anomalous timesheets, and auto-generates invoice drafts when milestones are met.
                </p>
              </div>
              <div className="flex md:flex-col justify-between items-end gap-3 mt-4 md:mt-0 self-stretch md:self-auto">
                <span className="text-[10px] font-mono text-[#7E769B]">Service: BillingAudit</span>
                <span className="try">Active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Methodology Section (Method Rows List) */}
      <section id="methodology" className="sect">
        <div className="wrap">
          <div className="head rev mb-12">
            <div className="eyebrow mb-4"><span>The Method</span></div>
            <h2 className="text-[30px] md:text-[44px] font-extrabold text-white leading-[1.15] tracking-tight">
              Four stages of autonomous delivery
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {/* Method Row 1 */}
            <div className="node n-studio flex flex-col md:flex-row gap-6 p-6 items-start justify-between">
              <div>
                <span className="text-sm font-mono text-[#0088FF] block mb-1">Stage 01</span>
                <h3 className="text-white text-[17px] font-bold mb-2">Lead Intake Ingestion</h3>
                <p className="text-[13.5px] font-light text-[#B3ABC9] leading-relaxed max-w-[680px]">
                  CRM opportunity fields are parsed automatically. Initial client records and production project outlines are generated instantly with baseline templates.
                </p>
              </div>
            </div>

            {/* Method Row 2 */}
            <div className="node n-media flex flex-col md:flex-row gap-6 p-6 items-start justify-between">
              <div>
                <span className="text-sm font-mono text-[#63D516] block mb-1">Stage 02</span>
                <h3 className="text-white text-[17px] font-bold mb-2">Automated Matchmaking</h3>
                <p className="text-[13.5px] font-light text-[#B3ABC9] leading-relaxed max-w-[680px]">
                  Production kickoff tasks are assigned to qualified freelancers based on skill tags, vendor availability limits, and historical execution records.
                </p>
              </div>
            </div>

            {/* Method Row 3 */}
            <div className="node n-artist flex flex-col md:flex-row gap-6 p-6 items-start justify-between">
              <div>
                <span className="text-sm font-mono text-[#FF9500] block mb-1">Stage 03</span>
                <h3 className="text-white text-[17px] font-bold mb-2">Live Show Execution</h3>
                <p className="text-[13.5px] font-light text-[#B3ABC9] leading-relaxed max-w-[680px]">
                  Show cue boards are verified. Crew members are checked-in, cue triggers are dispatched, and stage incidents are tracked to prevent scheduling overrides.
                </p>
              </div>
            </div>

            {/* Method Row 4 */}
            <div className="node n-event flex flex-col md:flex-row gap-6 p-6 items-start justify-between">
              <div>
                <span className="text-sm font-mono text-[#FF05E6] block mb-1">Stage 04</span>
                <h3 className="text-white text-[17px] font-bold mb-2">Billing Audits</h3>
                <p className="text-[13.5px] font-light text-[#B3ABC9] leading-relaxed max-w-[680px]">
                  Done task logs are audited. Hours are cross-checked against project bounds, compiling audit summaries and drafting invoice entries.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section (List View) */}
      <section id="faq" className="sect">
        <div className="wrap">
          <div className="head rev mb-12">
            <div className="eyebrow mb-4"><span>Common Queries</span></div>
            <h2 className="text-[30px] md:text-[44px] font-extrabold text-white leading-[1.15] tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            <div className="card p-6">
              <h4 className="text-white text-[15px] font-bold mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#9664FF]" /> How does Airtable integration work?
              </h4>
              <p className="text-[13.5px] font-light text-[#B3ABC9] leading-relaxed pl-6">
                Astra Black connects directly to your Airtable bases via Personal Access Tokens. Agents read data from tables, execute logic in the middleware, and write structural updates back, excluding read-only computed fields.
              </p>
            </div>

            <div className="card p-6">
              <h4 className="text-white text-[15px] font-bold mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#9664FF]" /> Are the background agents autonomous?
              </h4>
              <p className="text-[13.5px] font-light text-[#B3ABC9] leading-relaxed pl-6">
                Yes, our background agents monitor table modifications, structure briefs, and draft contract recommendations. Crucial system writes are always verified and deterministic to ensure database safety.
              </p>
            </div>

            <div className="card p-6">
              <h4 className="text-white text-[15px] font-bold mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#9664FF]" /> What is the client portal for?
              </h4>
              <p className="text-[13.5px] font-light text-[#B3ABC9] leading-relaxed pl-6">
                The client portal is a secure, external interface where your agency clients can review task logs, check shared assets, and approve or request changes on deliverable milestones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="pt-[130px] pb-[150px] border-t border-[#241a42]">
        <div className="wrap text-center flex flex-col items-center">
          <div className="eyebrow mb-6 justify-center"><span>Get Started</span></div>
          <h2 className="text-clamp-[30px,4.4vw,46px] font-extrabold text-white leading-[1.18] mb-6 max-w-[650px] tracking-tight">
            Supercharge your agency database
          </h2>
          <p className="text-[15.5px] font-light text-[#B3ABC9] max-w-[500px] mb-8 leading-relaxed">
            Deploy specialized agent workflows on top of your existing base databases today.
          </p>
          <a href="#" className="btn flex items-center gap-2.5">
            Request Invitation <ArrowRight className="w-4.5 h-4.5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#241a42] bg-[#060110]/50 relative z-10 px-4 md:px-8">
        <div className="max-w-[1080px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-[#7E769B] text-xs">
          <div className="text-center md:text-left">
            <span className="font-extrabold tracking-[0.25em] text-white text-md block mb-1">
              ASTRA<span className="text-[#6E28FF]">BLACK</span>
            </span>
            <p className="text-[11px] font-light">&copy; 2026 Astra Black. All rights reserved.</p>
          </div>
          <div className="flex gap-6 font-semibold uppercase tracking-wider text-[11px]">
            <a href="#" className="hover:text-white transition-colors">Privacy policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of service</a>
            <a href="#" className="hover:text-white transition-colors">Developer API</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
