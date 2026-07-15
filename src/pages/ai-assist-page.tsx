import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowUpIcon,
  CheckIcon,
  ClipboardIcon,
  Loader2Icon,
  RadioIcon,
  RotateCcwIcon,
  WalletIcon,
  WorkflowIcon,
  FolderKanbanIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { aiAssist } from "@/lib/api/platform"
import { ApiError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

type ContextMode = "general" | "live_ops" | "crm" | "finance" | "delivery"

type Msg = {
  id: string
  role: "user" | "assistant"
  text: string
  provider?: string
  context?: ContextMode
  at: number
  links?: { label: string; href: string }[]
}

const MODES: {
  id: ContextMode
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: "general", label: "General", hint: "Anything in Cosmos OS", icon: SparkOrbit },
  { id: "live_ops", label: "Live ops", hint: "Cues, crew, incidents", icon: RadioIcon },
  { id: "crm", label: "CRM", hint: "Pipeline & accounts", icon: WorkflowIcon },
  { id: "delivery", label: "Delivery", hint: "Projects & assets", icon: FolderKanbanIcon },
  { id: "finance", label: "Finance", hint: "Time & budgets", icon: WalletIcon },
]

const PROMPTS: Record<ContextMode, string[]> = {
  general: [
    "What should I focus on today across the agency?",
    "How do I use the client portal for approvals?",
    "Give me a 60-second Agency OS rundown",
  ],
  live_ops: [
    "How should I run the show cues tonight?",
    "Incident triage checklist for critical AV failures",
    "When do I advance vs complete a cue?",
  ],
  crm: [
    "What should I prioritize in the CRM pipeline?",
    "Draft a follow-up after a negotiation call",
    "How do I advance a deal stage cleanly?",
  ],
  delivery: [
    "Draft a client brief outline for a brand film",
    "Review checklist before sending assets for approval",
    "How should I structure campaign → project → asset?",
  ],
  finance: [
    "Budget risk flags for delivery this week",
    "How do I log billable time against a project?",
    "What utilization % should trigger a scope conversation?",
  ],
}

function SparkOrbit({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="rotate(-28 12 12)"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="4.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeOpacity="0.5"
        transform="rotate(48 12 12)"
      />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
      <circle cx="19.2" cy="9.2" r="1.2" fill="currentColor" />
    </svg>
  )
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function welcome(mode: ContextMode): Msg {
  const labels: Record<ContextMode, string> = {
    general: "agency operations",
    live_ops: "live show calling, crew, and incidents",
    crm: "pipeline, accounts, and next steps",
    delivery: "campaigns, projects, and asset handoffs",
    finance: "time, budgets, and utilization",
  }
  return {
    id: uid(),
    role: "assistant",
    text: `I’m Cosmos AI — scoped to **${labels[mode]}**.\n\nAsk a question, or pick a prompt below. I’ll keep answers short and ops-ready.`,
    provider: "cosmos",
    context: mode,
    at: Date.now(),
    links: [
      { label: "Cues", href: "/cues" },
      { label: "CRM", href: "/crm" },
      { label: "Finance", href: "/finance" },
    ],
  }
}

/** Lightweight markdown-ish: bold **text**, newlines, bullets */
function renderText(text: string) {
  const lines = text.split("\n")
  return lines.map((line, li) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) => {
      if (chunk.startsWith("**") && chunk.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold">
            {chunk.slice(2, -2)}
          </strong>
        )
      }
      return <span key={i}>{chunk}</span>
    })
    return (
      <span key={li} className="block">
        {parts}
        {li < lines.length - 1 ? <br /> : null}
      </span>
    )
  })
}

export function AiAssistPage() {
  const [mode, setMode] = useState<ContextMode>("general")
  const [messages, setMessages] = useState<Msg[]>(() => [welcome("general")])
  const [prompt, setPrompt] = useState("")
  const [pending, setPending] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, pending])

  function switchMode(next: ContextMode) {
    setMode(next)
    setMessages([welcome(next)])
    setPrompt("")
    inputRef.current?.focus()
  }

  function clearChat() {
    setMessages([welcome(mode)])
    setPrompt("")
    toast.success("Conversation cleared")
  }

  async function copyMsg(m: Msg) {
    try {
      await navigator.clipboard.writeText(m.text.replace(/\*\*/g, ""))
      setCopiedId(m.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      toast.error("Could not copy")
    }
  }

  async function send(text: string) {
    const q = text.trim()
    if (!q || pending) return
    const userMsg: Msg = {
      id: uid(),
      role: "user",
      text: q,
      context: mode,
      at: Date.now(),
    }
    setMessages((m) => [...m, userMsg])
    setPrompt("")
    setPending(true)
    try {
      const res = await aiAssist(q, mode)
      const data = res.data as
        | { reply?: string; provider?: string; links?: { label: string; href: string }[] }
        | undefined
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          text: data?.reply || "No reply",
          provider: data?.provider,
          context: mode,
          at: Date.now(),
          links: data?.links,
        },
      ])
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          text:
            err instanceof ApiError
              ? `Couldn’t reach assist: ${err.message}`
              : "Assist failed — try again.",
          at: Date.now(),
        },
      ])
    } finally {
      setPending(false)
      inputRef.current?.focus()
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send(prompt)
    }
  }

  const suggestions = PROMPTS[mode]
  const showEmptyHints = messages.length <= 1 && !pending

  return (
    <div className="mx-auto flex h-[calc(100dvh-8.5rem)] w-full max-w-3xl flex-col gap-0 sm:h-[calc(100dvh-9.5rem)]">
      {/* Header */}
      <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10">
            <SparkOrbit className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Cosmos AI</h1>
            <p className="text-muted-foreground text-sm">
              Agency-aware assist · scoped mode shapes answers
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="w-fit" onClick={clearChat}>
          <RotateCcwIcon className="size-3.5" />
          Clear
        </Button>
      </div>

      {/* Mode rail */}
      <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:mb-4 sm:flex-wrap sm:overflow-visible">
        {MODES.map((m) => {
          const Icon = m.icon
          const active = mode === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => switchMode(m.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="font-medium">{m.label}</span>
            </button>
          )
        })}
      </div>

      {/* Chat shell */}
      <Card className="border-border/80 flex min-h-0 flex-1 flex-col overflow-hidden p-0 shadow-sm">
        <div
          ref={scrollerRef}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-4 sm:px-5 sm:py-5"
        >
          {messages.map((m) => {
            const isUser = m.role === "user"
            return (
              <div
                key={m.id}
                className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "flex-row")}
              >
                {!isUser ? (
                  <div className="bg-muted text-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-white/10">
                    <SparkOrbit className="size-4" />
                  </div>
                ) : null}
                <div
                  className={cn(
                    "group relative max-w-[min(100%,28rem)] sm:max-w-[min(100%,32rem)]",
                    isUser && "items-end",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      isUser
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted/80 text-foreground rounded-bl-md ring-1 ring-border/50",
                    )}
                  >
                    <div className="whitespace-pre-wrap">{renderText(m.text)}</div>
                    {m.links && m.links.length > 0 && !isUser ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {m.links.map((l) => (
                          <Link
                            key={l.href}
                            to={l.href}
                            className="bg-background/60 hover:bg-background inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors"
                          >
                            {l.label} →
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "text-muted-foreground mt-1 flex items-center gap-2 px-1 text-[10px]",
                      isUser && "justify-end",
                    )}
                  >
                    <span>
                      {new Date(m.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {m.provider ? <span className="opacity-70">· {m.provider}</span> : null}
                    {!isUser ? (
                      <button
                        type="button"
                        className="hover:text-foreground inline-flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => void copyMsg(m)}
                        aria-label="Copy reply"
                      >
                        {copiedId === m.id ? (
                          <CheckIcon className="size-3" />
                        ) : (
                          <ClipboardIcon className="size-3" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}

          {pending ? (
            <div className="flex gap-2.5">
              <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-full">
                <SparkOrbit className="size-4 animate-pulse" />
              </div>
              <div className="bg-muted/80 text-muted-foreground flex items-center gap-2 rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm ring-1 ring-border/50">
                <span className="flex gap-1">
                  <span className="bg-foreground/40 size-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
                  <span className="bg-foreground/40 size-1.5 animate-bounce rounded-full [animation-delay:120ms]" />
                  <span className="bg-foreground/40 size-1.5 animate-bounce rounded-full [animation-delay:240ms]" />
                </span>
                Thinking…
              </div>
            </div>
          ) : null}

          {showEmptyHints ? (
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => void send(s)}
                  className="bg-card hover:bg-muted/50 border-border rounded-xl border px-3 py-2.5 text-left text-xs leading-snug transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Composer */}
        <div className="border-border bg-card/80 border-t p-3 backdrop-blur-sm sm:p-4">
          {!showEmptyHints ? (
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
              {suggestions.slice(0, 2).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => void send(s)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-colors"
                >
                  {s.length > 42 ? `${s.slice(0, 40)}…` : s}
                </button>
              ))}
            </div>
          ) : null}
          <div className="bg-background focus-within:ring-ring/40 flex items-end gap-2 rounded-2xl border p-1.5 shadow-xs focus-within:ring-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value)
                const t = e.target
                t.style.height = "auto"
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`
              }}
              onKeyDown={onKeyDown}
              placeholder={
                mode === "live_ops"
                  ? "Ask about cues, crew, or incidents…"
                  : mode === "crm"
                    ? "Ask about pipeline or accounts…"
                    : mode === "finance"
                      ? "Ask about budgets or time…"
                      : "Message Cosmos AI…"
              }
              className="placeholder:text-muted-foreground max-h-[120px] min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none"
              disabled={pending}
            />
            <Button
              size="icon"
              className="mb-0.5 size-9 shrink-0 rounded-xl"
              disabled={pending || !prompt.trim()}
              onClick={() => void send(prompt)}
              aria-label="Send"
            >
              {pending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <ArrowUpIcon className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-center text-[10px]">
            Enter to send · Shift+Enter for newline · Mode:{" "}
            <span className="text-foreground/80 font-medium">
              {MODES.find((m) => m.id === mode)?.label}
            </span>
          </p>
        </div>
      </Card>
    </div>
  )
}
