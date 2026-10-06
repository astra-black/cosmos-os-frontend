import { useState } from "react"
import { DollarSignIcon, FileTextIcon, Loader2Icon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createChangeOrder, type ChangeOrder } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"

type ChangeOrderModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  clientId?: string
  currentPlannedBudget?: number
  onSuccess?: (newChangeOrder: ChangeOrder) => void
}

export function ChangeOrderModal({
  open,
  onOpenChange,
  projectId,
  clientId,
  currentPlannedBudget = 0,
  onSuccess,
}: ChangeOrderModalProps) {
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [scopeDelta, setScopeDelta] = useState("")
  const [costDelta, setCostDelta] = useState("")

  const deltaNum = Number(costDelta) || 0
  const baselineNum = Number(currentPlannedBudget) || 0
  const newTotalNum = baselineNum + deltaNum

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!description.trim()) {
      toast.error("Description / Scope details required")
      return
    }

    setBusy(true)
    try {
      const res = await createChangeOrder(projectId, {
        clientId,
        title: title.trim(),
        description: description.trim(),
        scopeDelta: scopeDelta.trim() || description.trim(),
        costDelta: deltaNum,
      })

      toast.success("Formal Change Order issued with 1-click VIP sign-off link!")
      onSuccess?.(res.data)
      onOpenChange(false)
      // reset form
      setTitle("")
      setDescription("")
      setScopeDelta("")
      setCostDelta("")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to issue Change Order")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileTextIcon className="size-5 text-amber-400" />
            Issue Formal Change Order
          </DialogTitle>
          <DialogDescription>
            Specify scope deltas and financial impact. Generates a binding 1-click VIP review link for client sign-off.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="co-title">Change Order Title *</Label>
            <Input
              id="co-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add Extra LED Wall Section & Extended Rehearsal Hours"
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="co-description">Reason & Background *</Label>
            <Textarea
              id="co-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain why the scope is expanding (e.g., Client requested 2 additional 4K LED panels and 3 extra hours of FOH tech crew)."
              required
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="co-scope">Scope Delta Items</Label>
            <Textarea
              id="co-scope"
              rows={3}
              value={scopeDelta}
              onChange={(e) => setScopeDelta(e.target.value)}
              placeholder="• 2x Unilumin P2.5 LED Panels&#10;• 3x FOH Audio Technician Hours&#10;• 1x Additional Power Drop"
            />
          </div>

          {/* Scope Delta Financial Math Card */}
          <div className="rounded-xl border border-amber-800/40 bg-slate-900/80 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-400/90 flex items-center gap-1.5">
              <DollarSignIcon className="size-3.5" />
              Financial Scope Delta Math
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-slate-800/60 p-2.5">
                <div className="text-[10px] uppercase text-slate-400">Baseline Budget</div>
                <div className="mt-1 font-mono text-sm font-semibold text-slate-200">
                  ${baselineNum.toLocaleString()}
                </div>
              </div>

              <div className="rounded-lg bg-amber-950/40 border border-amber-700/40 p-2.5">
                <div className="text-[10px] uppercase text-amber-400">Cost Delta (+$)</div>
                <Input
                  type="number"
                  step="any"
                  value={costDelta}
                  onChange={(e) => setCostDelta(e.target.value)}
                  placeholder="0"
                  className="mt-1 h-7 font-mono text-center text-xs font-bold text-amber-300 border-amber-600/50 bg-slate-900"
                />
              </div>

              <div className="rounded-lg bg-emerald-950/40 border border-emerald-700/40 p-2.5">
                <div className="text-[10px] uppercase text-emerald-400">New Total Contract</div>
                <div className="mt-1 font-mono text-sm font-bold text-emerald-300">
                  ${newTotalNum.toLocaleString()}
                </div>
              </div>
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
            <Button
              type="submit"
              disabled={busy || !title || !description}
              className="bg-amber-600 hover:bg-amber-500 text-white gap-1.5"
            >
              {busy ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
              Issue Change Order & Sign-Off Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
