import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowUpIcon,
  CheckIcon,
  ClipboardIcon,
  Loader2Icon,
  PanelLeftIcon,
  RadioIcon,
  RotateCcwIcon,
  WalletIcon,
  WorkflowIcon,
  FolderKanbanIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { aiAssist, type AiAction, type AiRecordSelection } from "@/lib/api/platform"
import { useClients, useProjects, useCampaigns, useTasks, useVendors } from "@/hooks/use-agency-data"
import { useEventsSimpleCache } from "@/hooks/use-events-simple-cache"
import type { Event } from "@/types/agency"
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
  proposedAction?: AiAction
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
    "Create a task to send the client deck this week",
    "Give me a 60-second Agency OS rundown",
  ],
  live_ops: [
    "How should I run the show cues tonight?",
    "Log a critical AV incident for tonight's event",
    "When do I advance vs complete a cue?",
  ],
  crm: [
    "What should I prioritize in the CRM pipeline?",
    "Create a $45k lead opportunity for our top client",
    "Draft a follow-up after a negotiation call",
  ],
  delivery: [
    "Create an approval request for the latest deliverable",
    "Review checklist before sending assets for approval",
    "How should I structure campaign → project → asset?",
  ],
  finance: [
    "Budget risk flags for delivery this week",
    "Log 2 hours billable time on the active project",
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
    text: `I’m Astrid — scoped to **${labels[mode]}**.\n\nI can answer with structured ops guidance **and** propose real actions (tasks, time, CRM deals, incidents, approvals). Confirm before anything is written.`,
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
  const { data: clients } = useClients()
  const { data: projects } = useProjects()
  const { data: campaigns } = useCampaigns()
  const { data: tasks } = useTasks()
  const { data: vendors } = useVendors()
  const { data: events } = useEventsSimpleCache()
  const [selection, setSelection] = useState<AiRecordSelection>({})

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
      const res = await aiAssist(q, mode, undefined, selection)
      const data = res.data as
        | { reply?: string; provider?: string; links?: { label: string; href: string }[]; proposedAction?: AiAction }
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
          proposedAction: data?.proposedAction,
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

  async function confirmAction(messageId: string, action: AiAction) {
    if (pending) return
    setPending(true)
    try {
      const { summary: _summary, ...payload } = action
      const res = await aiAssist("Confirm the proposed action", mode, payload as AiAction, selection)
      const data = res.data
      setMessages((current) => current.map((message) => message.id === messageId
        ? {
            ...message,
            text: data?.reply || "Action completed.",
            proposedAction: undefined,
            links: data?.links?.length ? data.links : message.links,
            provider: data?.provider || message.provider,
          }
        : message))
      toast.success((data?.reply || "Action completed").split("\n")[0].replace(/\*\*/g, ""))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not complete action")
    } finally {
      setPending(false)
    }
  }

  function dismissAction(messageId: string) {
    setMessages((current) => current.map((message) => message.id === messageId
      ? { ...message, proposedAction: undefined, text: `${message.text}\n\nAction dismissed.` }
      : message))
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
    <div className="flex gap-4 h-[calc(100vh-5.5rem)]">
      {/* Left context rail */}
      <div className="hidden lg:flex w-52 shrink-0 flex-col gap-3">
        {/* Header card */}
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          <div className="size-9 rounded-xl bg-gradient-to-tr from-[#270045] to-[#7a5cc2] flex items-center justify-center text-white shrink-0">
            <SparkOrbit className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-sora font-semibold text-base leading-tight truncate">Astrid</h1>
            <p className="text-[11px] text-muted-foreground truncate">Agency Intelligence</p>
          </div>
        </div>

        {/* Mode buttons */}
        <div className="rounded-xl border border-border bg-card p-2 flex flex-col gap-1 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
          {MODES.map((m) => {
            const Icon = m.icon
            const active = mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => switchMode(m.id)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-colors",
                  active
                    ? "bg-[#270045] text-white rounded-xl"
                    : "text-muted-foreground hover:bg-surface-alt rounded-xl"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{m.label}</span>
              </button>
            )
          })}
        </div>

        {/* Context selector card */}
        <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-2.5 shadow-[0_1px_3px_0_rgba(39,0,69,0.08)] overflow-y-auto max-h-[45vh]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Scope Context</span>
            {Object.keys(selection).length > 0 && (
              <button
                type="button"
                onClick={() => setSelection({})}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <RecordSelect
              label="Project"
              value={selection.projectId}
              options={projects.map((item) => ({ id: item.projectId, label: item.projectName }))}
              onChange={(id) => {
                const item = projects.find((entry) => entry.projectId === id)
                setSelection((current) => ({ ...current, projectId: id || undefined, projectName: item?.projectName }))
              }}
            />
            <RecordSelect
              label="Client"
              value={selection.clientId}
              options={clients.map((item) => ({ id: item.clientId, label: item.name }))}
              onChange={(id) => {
                const item = clients.find((entry) => entry.clientId === id)
                setSelection((current) => ({ ...current, clientId: id || undefined, clientName: item?.name }))
              }}
            />
            <RecordSelect
              label="Campaign"
              value={selection.campaignId}
              options={campaigns.map((item) => ({ id: item.campaignId, label: item.name }))}
              onChange={(id) => {
                const item = campaigns.find((entry) => entry.campaignId === id)
                setSelection((current) => ({ ...current, campaignId: id || undefined, campaignName: item?.name }))
              }}
            />
            <RecordSelect
              label="Event"
              value={selection.eventId}
              options={(events ?? []).map((item: Event) => ({ id: item.eventId || item.id, label: item.name }))}
              onChange={(id) => {
                const item = (events ?? []).find((entry: Event) => (entry.eventId || entry.id) === id)
                setSelection((current) => ({ ...current, eventId: id || undefined, eventName: item?.name }))
              }}
            />
            <RecordSelect
              label="Vendor"
              value={selection.vendorId}
              options={vendors.map((item) => ({ id: item.vendorId, label: item.name }))}
              onChange={(id) => {
                const item = vendors.find((entry) => entry.vendorId === id)
                setSelection((current) => ({ ...current, vendorId: id || undefined, vendorName: item?.name }))
              }}
            />
            <RecordSelect
              label="Task"
              value={selection.taskId}
              options={tasks.map((item) => ({ id: item.taskId, label: item.title }))}
              onChange={(id) => {
                const item = tasks.find((entry) => entry.taskId === id)
                setSelection((current) => ({ ...current, taskId: id || undefined, taskTitle: item?.title }))
              }}
            />
          </div>
        </div>

        {/* Clear chat button at bottom */}
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-auto rounded-xl gap-2 border-border text-muted-foreground hover:text-foreground"
          onClick={clearChat}
        >
          <RotateCcwIcon className="size-3.5" />
          Clear chat
        </Button>
      </div>

      {/* Main chat */}
      <div className="flex flex-1 flex-col rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_0_rgba(39,0,69,0.08)]">
        {/* Top bar */}
        <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-3 bg-surface-alt/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-full bg-gradient-to-tr from-[#270045] to-[#7a5cc2] flex items-center justify-center text-white shrink-0">
              <SparkOrbit className="size-4" />
            </div>
            <div>
              <span className="font-sora font-semibold text-sm text-foreground">
                {MODES.find((m) => m.id === mode)?.label}
              </span>
              <span className="text-muted-foreground text-xs ml-2 hidden sm:inline">
                · {MODES.find((m) => m.id === mode)?.hint}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground hover:text-foreground h-8 gap-1.5"
              onClick={clearChat}
            >
              <RotateCcwIcon className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>

        {/* Mobile mode switcher pills */}
        <div className="flex gap-1.5 overflow-x-auto p-2 border-b border-border lg:hidden shrink-0 bg-card">
          {MODES.map((m) => {
            const Icon = m.icon
            const active = mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => switchMode(m.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "bg-[#270045] text-white"
                    : "border border-border text-muted-foreground hover:bg-surface-alt hover:text-foreground"
                )}
              >
                <Icon className="size-3 shrink-0" />
                <span>{m.label}</span>
              </button>
            )
          })}
        </div>

        {/* Scroller */}
        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4"
        >
          {messages.map((m) => {
            const isUser = m.role === "user"
            if (isUser) {
              return (
                <div key={m.id} className="flex flex-col items-end">
                  <div className="bg-[#270045] text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap ml-auto">
                    {renderText(m.text)}
                  </div>
                  <div className="text-muted-foreground mt-1 text-[10px] px-1">
                    {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              )
            }

            return (
              <div key={m.id} className="flex items-start gap-2.5 group">
                <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-[#270045] to-[#7a5cc2] flex items-center justify-center text-white shrink-0 mt-0.5">
                  <SparkOrbit className="size-3.5" />
                </div>
                <div className="flex flex-col gap-1 max-w-[85%]">
                  <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-foreground">
                    <div className="whitespace-pre-wrap">{renderText(m.text)}</div>

                    {/* Proposed action card */}
                    {m.proposedAction ? (
                      <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                        <p className="text-xs font-semibold text-foreground">Proposed Action</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {m.proposedAction.summary || actionDescription(m.proposedAction)}
                        </p>
                        <div className="mt-2.5 flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-[#270045] hover:bg-[#3b0066] text-white h-7 text-xs px-3"
                            disabled={pending}
                            onClick={() => void confirmAction(m.id, m.proposedAction!)}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-3 border-border"
                            disabled={pending}
                            onClick={() => dismissAction(m.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {/* Link pills */}
                    {m.links && m.links.length > 0 ? (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {m.links.map((l) => (
                          <Link
                            key={l.href}
                            to={l.href}
                            className="rounded-full bg-surface-alt border border-border px-3 py-1 text-xs hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            {l.label} →
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="text-muted-foreground flex items-center gap-2 px-1 text-[10px]">
                    <span>
                      {new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {m.provider ? <span>· {m.provider}</span> : null}
                    <button
                      type="button"
                      className="hover:text-foreground inline-flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => void copyMsg(m)}
                      aria-label="Copy reply"
                    >
                      {copiedId === m.id ? (
                        <CheckIcon className="size-3 text-success" />
                      ) : (
                        <ClipboardIcon className="size-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {pending ? (
            <div className="flex items-start gap-2.5">
              <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-[#270045] to-[#7a5cc2] flex items-center justify-center text-white shrink-0 mt-0.5 animate-pulse">
                <SparkOrbit className="size-3.5" />
              </div>
              <div className="bg-surface border border-border rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
                <span className="flex gap-1">
                  <span className="bg-primary/60 size-1.5 animate-bounce rounded-full [animation-delay:0ms]" />
                  <span className="bg-primary/60 size-1.5 animate-bounce rounded-full [animation-delay:120ms]" />
                  <span className="bg-primary/60 size-1.5 animate-bounce rounded-full [animation-delay:240ms]" />
                </span>
                Thinking…
              </div>
            </div>
          ) : null}
        </div>

        {/* Quick prompts */}
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none shrink-0">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => void send(s)}
              className="rounded-full bg-surface-alt border border-border px-3 py-1.5 text-xs hover:bg-primary/10 hover:text-primary shrink-0 transition-colors whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex items-end gap-2 bg-surface-alt rounded-xl border border-border px-3 py-2">
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
                      : "Message Astrid…"
              }
              className="placeholder:text-muted-foreground max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent py-1 text-sm outline-none border-none focus:ring-0 leading-normal"
              disabled={pending}
            />
            <button
              type="button"
              disabled={pending || !prompt.trim()}
              onClick={() => void send(prompt)}
              className="h-8 w-8 rounded-lg bg-[#270045] hover:bg-[#3b0066] text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors"
              aria-label="Send"
            >
              {pending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <ArrowUpIcon className="size-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RecordSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value?: string
  options: { id: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="grid gap-1 text-xs">
      <span className="text-muted-foreground font-medium">{label}</span>
      <Select value={value || ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">All {label.toLowerCase()} records</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  )
}

function actionDescription(action: AiAction) {
  if (action.type === "create_task") {
    return `Create task “${action.title}” on ${action.projectName || action.projectId || "project"}`
  }
  if (action.type === "create_notification") return `Create notification “${action.title}”`
  if (action.type === "create_time_entry") {
    return `Log ${action.hours}h on ${action.projectName || action.projectId || "project"} for ${action.date}`
  }
  if (action.type === "create_opportunity") {
    return `Create deal “${action.name}” for ${action.clientName || action.clientId || "client"}`
  }
  if (action.type === "create_incident") {
    return `Log incident “${action.title}” on ${action.eventName || action.eventId || "event"}`
  }
  if (action.type === "create_approval") {
    return `Request approval “${action.title}” on ${action.projectName || action.projectId || "project"}`
  }
  return "Perform action"
}
