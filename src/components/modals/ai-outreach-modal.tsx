import { useState } from "react"
import { BotIcon, Loader2Icon, SendIcon, SparklesIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
}

export function AiOutreachModal({
  open,
  onOpenChange,
  mode,
  targetId,
  targetName,
  projectName,
}: AiOutreachModalProps) {
  const [drafting, setDrafting] = useState(false)
  const [sending, setSending] = useState(false)
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [hasDrafted, setHasDrafted] = useState(false)

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
      setTo(d.to || "")
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
      toast.success("Email sent successfully via Resend")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send email")
    } finally {
      setSending(false)
    }
  }

  const title =
    mode === "proposal"
      ? `AI Proposal Generator — ${targetName}`
      : mode === "followup"
        ? `AI CRM Follow-up — ${targetName}`
        : `AI Vendor Outreach — ${targetName}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-5 text-sky-400" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Generate tailored copy using AI, review or customize the text, and dispatch directly via Resend.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {!hasDrafted ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center">
              <BotIcon className="size-10 text-sky-400/80" />
              <div>
                <p className="text-sm font-medium">Ready to draft for {targetName}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {mode === "proposal"
                    ? "Reads deal value, stage, and client contact info to compose a structured proposal."
                    : mode === "followup"
                      ? "Drafts a concise check-in email to move the deal to the next stage."
                      : "Drafts a professional availability and quote request email."}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => void handleGenerateDraft()}
                disabled={drafting}
                className="bg-sky-600 hover:bg-sky-500 text-white gap-2"
              >
                {drafting ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
                Generate AI Draft
              </Button>
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
                    Regenerate
                  </Button>
                </div>
                <Textarea
                  id="ai-outreach-body"
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
            >
              {sending ? <Loader2Icon className="size-4 animate-spin" /> : <SendIcon className="size-4" />}
              Send via Resend
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
