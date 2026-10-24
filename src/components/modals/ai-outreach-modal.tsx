import { useEffect, useState } from "react"
import { BotIcon, ExternalLinkIcon, Loader2Icon, MailIcon, PenLineIcon, SendIcon, SparklesIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  draftOpportunityFollowup,
  draftOpportunityProposal,
  draftVendorOutreach,
  sendOpportunityEmail,
  sendVendorOutreach,
  type AiDraftResult,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"

type Mode = "proposal" | "followup" | "vendor"

type AiOutreachModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  targetId: string
  targetName: string
  projectName?: string
  recipientEmail?: string
  recipientName?: string
}

export function AiOutreachModal({
  open,
  onOpenChange,
  mode,
  targetId,
  targetName,
  projectName,
  recipientEmail,
  recipientName,
}: AiOutreachModalProps) {
  const [drafting, setDrafting] = useState(false)
  const [sending, setSending] = useState(false)
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [hasDrafted, setHasDrafted] = useState(false)

  useEffect(() => {
    if (open) {
      if (recipientEmail) {
        setTo(recipientEmail)
      }
    } else {
      setHasDrafted(false)
      setTo("")
      setSubject("")
      setBody("")
    }
  }, [open, recipientEmail])

  async function handleGenerateDraft() {
    if (!targetId) return
    setDrafting(true)
    try {
      let res: { data: AiDraftResult }
      if (mode === "proposal") {
        res = await draftOpportunityProposal(targetId)
      } else if (mode === "followup") {
        res = await draftOpportunityFollowup(targetId)
      } else {
        res = await draftVendorOutreach(targetId, projectName)
      }

      const d = res.data
      setTo(d.to || recipientEmail || "")
      setSubject(d.subject || "")
      setBody(d.body || "")
      setHasDrafted(true)
      toast.success("AI draft generated")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate AI draft")
    } finally {
      setDrafting(false)
    }
  }

  async function handleSend() {
    if (!to.trim()) {
      toast.error("Recipient email is required")
      return
    }
    if (!subject.trim()) {
      toast.error("Subject is required")
      return
    }
    if (!body.trim()) {
      toast.error("Email body is required")
      return
    }

    setSending(true)
    try {
      if (mode === "vendor") {
        await sendVendorOutreach(targetId, { to, subject, body, projectName })
      } else {
        await sendOpportunityEmail(targetId, { kind: mode, to, subject, body })
      }
      toast.success("Email sent successfully")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send email")
    } finally {
      setSending(false)
    }
  }

  const title =
    mode === "proposal"
      ? `Proposal — ${targetName}`
      : mode === "followup"
        ? `Follow-up — ${targetName}`
        : `Vendor Outreach — ${targetName}`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-card border-l border-border shadow-2xl"
      >
        <SheetHeader className="p-6 border-b border-border bg-card pr-12 shrink-0">
          <SheetTitle className="flex items-center gap-2 font-sora text-xl font-bold text-foreground">
            <SparklesIcon className="size-5 text-sky-400" />
            {title}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-1">
            Generate tailored copy using AI or draft directly, review, and dispatch.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!hasDrafted ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center bg-surface/30">
              <BotIcon className="size-10 text-sky-400/80" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {recipientEmail ? `Draft email to ${recipientEmail}` : `Ready to draft for ${targetName}`}
                </p>
                <p className="text-muted-foreground mt-1 text-xs max-w-sm">
                  {mode === "proposal"
                    ? "Reads deal value, next steps, and client contact info to compose a structured proposal."
                    : mode === "followup"
                      ? "Drafts a concise check-in email to move the deal forward."
                      : "Drafts a professional availability and quote request email."}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  type="button"
                  onClick={() => void handleGenerateDraft()}
                  disabled={drafting}
                  className="bg-sky-600 hover:bg-sky-500 text-white gap-2 font-medium"
                >
                  {drafting ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
                  Generate AI Draft
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTo(recipientEmail || "")
                    setSubject(mode === "proposal" ? `Proposal — ${targetName}` : `Next steps — ${targetName}`)
                    setHasDrafted(true)
                  }}
                  className="gap-1.5"
                >
                  <PenLineIcon className="size-3.5" />
                  Write Manually
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="ai-outreach-to">Recipient email</Label>
                <Input
                  id="ai-outreach-to"
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="client@company.com"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="ai-outreach-subject">Subject</Label>
                <Input
                  id="ai-outreach-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ai-outreach-body">Email body</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-sky-400 hover:text-sky-300"
                    disabled={drafting}
                    onClick={() => void handleGenerateDraft()}
                  >
                    {drafting ? <Loader2Icon className="size-3 animate-spin mr-1" /> : <SparklesIcon className="size-3 mr-1" />}
                    Regenerate AI
                  </Button>
                </div>
                <Textarea
                  id="ai-outreach-body"
                  rows={9}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Compose your email here..."
                  className="font-mono text-xs leading-relaxed"
                />
              </div>
            </>
          )}
        </div>

        <SheetFooter className="p-4 border-t border-border bg-surface-alt/40 flex flex-row items-center justify-between gap-2 shrink-0">
          <div>
            {hasDrafted && to ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground gap-1.5 h-8 px-2"
                onClick={() => {
                  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
                  window.open(mailto, "_blank")
                }}
              >
                <ExternalLinkIcon className="size-3.5" />
                Open in Mail App
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            {hasDrafted && (
              <Button
                type="button"
                onClick={() => void handleSend()}
                disabled={sending || !to}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 tracking-wide uppercase text-xs gap-2"
              >
                {sending ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
                SEND EMAIL
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
