import { useState } from "react"
import { toast } from "sonner"
import { LoaderCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { AgencyClient } from "@/types/agency"

const STAGES = ["prospect", "onboarding", "active", "paused", "churned"] as const
const HEALTH_OPTIONS = ["strong", "watch", "new", "risk"] as const

type CreateClientModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (client: AgencyClient) => void
}

export function CreateClientModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateClientModalProps) {
  const [name, setName] = useState("")
  const [industry, setIndustry] = useState("")
  const [stage, setStage] = useState<string>("prospect")
  const [accountLead, setAccountLead] = useState("")
  const [primaryContact, setPrimaryContact] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [health, setHealth] = useState<string>("")
  const [arr, setArr] = useState("")
  const [tags, setTags] = useState("")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName("")
    setIndustry("")
    setStage("prospect")
    setAccountLead("")
    setPrimaryContact("")
    setEmail("")
    setPhone("")
    setHealth("")
    setArr("")
    setTags("")
    setNotes("")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Client name is required.")
      return
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Email is invalid.")
      return
    }
    if (arr.trim()) {
      const arrNum = Number(arr)
      if (!Number.isFinite(arrNum) || arrNum < 0) {
        setError("ARR must be a non-negative number.")
        return
      }
    }

    setBusy(true)
    setError(null)
    try {
      const payload: Partial<AgencyClient> = {
        name: name.trim(),
        industry: industry.trim(),
        stage,
        accountLead: accountLead.trim() || undefined,
        primaryContact: primaryContact.trim() || undefined,
        email: email.trim(),
        phone: phone.trim(),
        health: health || undefined,
        arr: arr.trim() ? Number(arr) : 0,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        notes: notes.trim(),
      }
      const res = await createClient(payload)
      if (res.data) {
        toast.success(`Client "${res.data.name}" added`)
        onSuccess(res.data)
        reset()
        onOpenChange(false)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create client account")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add Client Account</DialogTitle>
            <DialogDescription>
              Register a new client company, sponsor, or brand account in your CRM.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="client-name">Company Name *</Label>
                <Input
                  id="client-name"
                  placeholder="e.g. Acme Corp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="client-industry">Industry / Sector</Label>
                <Input
                  id="client-industry"
                  placeholder="e.g. Entertainment, Fintech"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="client-contact">Primary Contact</Label>
                <Input
                  id="client-contact"
                  placeholder="e.g. Maya Chen"
                  value={primaryContact}
                  onChange={(e) => setPrimaryContact(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="client-email">Contact Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  placeholder="contact@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="client-phone">Phone</Label>
                <Input
                  id="client-phone"
                  type="tel"
                  placeholder="Phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="client-lead">Account Lead / Owner</Label>
                <Input
                  id="client-lead"
                  placeholder="e.g. Alex Rivera"
                  value={accountLead}
                  onChange={(e) => setAccountLead(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="client-stage">Status / Stage</Label>
                <select
                  id="client-stage"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  disabled={busy}
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="client-health">Account Health</Label>
                <select
                  id="client-health"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={health}
                  onChange={(e) => setHealth(e.target.value)}
                  disabled={busy}
                >
                  <option value="">Not set</option>
                  {HEALTH_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="client-arr">ARR / Value ($)</Label>
                <Input
                  id="client-arr"
                  type="number"
                  min="0"
                  placeholder="e.g. 120000"
                  value={arr}
                  onChange={(e) => setArr(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="client-tags">Tags</Label>
              <Input
                id="client-tags"
                placeholder="retainer, priority, launch"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                disabled={busy}
              />
              <p className="text-muted-foreground text-xs">Separate tags with commas.</p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="client-notes">Account Notes & Overview</Label>
              <Textarea
                id="client-notes"
                placeholder="Key contracts, relationship history, special billing terms..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
              Add Client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
