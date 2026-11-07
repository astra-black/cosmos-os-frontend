import { useEffect, useState } from "react"
import { ClockIcon, FileTextIcon, ShieldIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

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
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Event } from "@/types/agency"
import { cn } from "@/lib/utils"

import { DataFreshnessPill, type DataFreshness } from "./data-freshness-pill"

const SOURCE_OPTIONS = [
  "Door team count · Gate A and B",
  "Door team count",
  "Manual head count",
  "Imported guest list (unverified)",
] as const

type UpdateAttendanceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: Event | null
  freshness?: DataFreshness
  feedNote?: string
}

/**
 * Figma 00.10 · 137–138 · Events · Update Attendance.
 * Designed as an audited manual update. Agency OS middleware has no attendance /
 * check-in-count audit API (only expectedAttendees on Event and crew check-in).
 * Save reports that gap instead of inventing success or ticketing integration.
 */
export function UpdateAttendanceDialog({
  open,
  onOpenChange,
  event,
  freshness = "Unverified",
  feedNote,
}: UpdateAttendanceDialogProps) {
  const [checkedIn, setCheckedIn] = useState("")
  const [asOf, setAsOf] = useState("")
  const [source, setSource] = useState<string>(SOURCE_OPTIONS[0])
  const [note, setNote] = useState("")

  useEffect(() => {
    if (!open || !event) return
    // Do not prefill Checked In from expectedAttendees — those are different fields.
    // Figma 137–138 has no Expected attendees control; leave that value out of this dialog.
    setCheckedIn("")
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, "0")
    const mm = String(now.getMinutes()).padStart(2, "0")
    setAsOf(`${hh}:${mm}`)
    setSource(SOURCE_OPTIONS[0])
    setNote("")
  }, [open, event])

  function handleSave() {
    toast.error(
      "Audited attendance updates are not available yet. Agency OS has no attendance count API with actor, source, and audit history — only expected attendees and crew check-in.",
    )
  }

  const subtitle = event
    ? [event.name, event.venue || event.location].filter(Boolean).join(" · ")
    : "Event"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cosmos-attendance-dialog max-w-[560px] gap-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="cosmos-attendance-dialog__header">
          <DialogTitle>Update Attendance</DialogTitle>
          <DialogDescription>{subtitle} · Agency OS</DialogDescription>
        </DialogHeader>

        <div className="cosmos-attendance-dialog__body">
          <div className="cosmos-attendance-dialog__feed">
            <DataFreshnessPill value={freshness} />
            <p>
              {feedNote ||
                "No connected scanner or registration feed for this event. Manual counts must be audited when the attendance API ships."}
            </p>
          </div>

          <div className="cosmos-attendance-dialog__fields">
            <div className="cosmos-attendance-dialog__field">
              <Label htmlFor="attendance-checked-in">
                Checked In <span aria-hidden>*</span>
              </Label>
              <div className="cosmos-attendance-dialog__input">
                <UsersIcon className="size-3.5 opacity-50" />
                <Input
                  id="attendance-checked-in"
                  inputMode="numeric"
                  value={checkedIn}
                  onChange={(e) => setCheckedIn(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Count"
                />
              </div>
            </div>
            <div className="cosmos-attendance-dialog__field">
              <Label htmlFor="attendance-as-of">As Of</Label>
              <div className="cosmos-attendance-dialog__input">
                <ClockIcon className="size-3.5 opacity-50" />
                <Input
                  id="attendance-as-of"
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                  placeholder="HH:MM"
                />
              </div>
            </div>
          </div>

          <div className="cosmos-attendance-dialog__field">
            <Label htmlFor="attendance-source">Source</Label>
            <div className="cosmos-attendance-dialog__input">
              <FileTextIcon className="size-3.5 opacity-50" />
              <Select
                id="attendance-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="cosmos-attendance-dialog__field">
            <Label htmlFor="attendance-note">Note</Label>
            <Textarea
              id="attendance-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal note — clients never see this."
              rows={3}
            />
          </div>

          <div className="cosmos-attendance-dialog__meta">
            <div>
              <p className="cosmos-attendance-dialog__meta-label">Recorded as</p>
              <p>Manual · not saved — audit API unavailable</p>
            </div>
            <span className={cn("project-status-pill", "is-info")}>Manual</span>
          </div>

          <div className="cosmos-attendance-dialog__note">
            <ShieldIcon className="size-3.5 shrink-0" />
            <p>
              Manual updates are labeled in every view and audited. Clients see the label and time,
              never the note. This control is ready; the Agency OS attendance write path is not.
            </p>
          </div>
        </div>

        <DialogFooter className="cosmos-attendance-dialog__footer">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!checkedIn.trim()}>
            Save Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
