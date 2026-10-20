import { useState } from "react"
import {
  ArrowRightIcon,
  BriefcaseIcon,
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  Loader2Icon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  SparklesIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { Opportunity } from "@/types/agency"

export type ParsedDealProfile = {
  contactName: string | null
  contactTitle: string | null
  contactEmail: string | null
  contactPhone: string | null
  linkedinUrl: string | null
  location: string | null
  companyName: string
  companyWebsite: string | null
  companyIndustry: string | null
  companyEmployees: string | null
  cleanNotes: string[]
}

export function parseDealProfile(deal: Opportunity): ParsedDealProfile {
  let contactName = deal.contactName || deal.primaryContact?.name || null
  let contactTitle = deal.contactTitle || deal.primaryContact?.title || null
  let contactEmail = deal.contactEmail || deal.primaryContact?.email || null
  let contactPhone = deal.contactPhone || deal.primaryContact?.phone || null
  let linkedinUrl: string | null = null
  let location: string | null = null
  let companyWebsite: string | null = null
  let companyIndustry: string | null = deal.clientIndustry || null
  let companyEmployees: string | null = null

  const notesText = [deal.notes, deal.clientNotes].filter(Boolean).join("\n")

  if (notesText) {
    const emailMatch = notesText.match(/Email:\s*([^\s\n\r]+)/i)
    if (!contactEmail && emailMatch) contactEmail = emailMatch[1].trim()

    const titleMatch = notesText.match(/Title:\s*([^\n\r]+)/i)
    if (!contactTitle && titleMatch) contactTitle = titleMatch[1].trim()

    const phoneMatch = notesText.match(/Phone:\s*([^\n\r]+)/i)
    if (!contactPhone && phoneMatch) contactPhone = phoneMatch[1].trim()

    const linkedinMatch = notesText.match(/LinkedIn:\s*([^\s\n\r]+)/i)
    if (linkedinMatch) {
      let lUrl = linkedinMatch[1].trim()
      if (lUrl && !lUrl.startsWith("http://") && !lUrl.startsWith("https://")) {
        lUrl = `https://${lUrl}`
      }
      linkedinUrl = lUrl
    }

    const locationMatch = notesText.match(/Location:\s*([^\n\r]+)/i)
    if (locationMatch) location = locationMatch[1].trim()

    const industryMatch = notesText.match(/Industry:\s*([^\n\r]+)/i)
    if (!companyIndustry && industryMatch) companyIndustry = industryMatch[1].trim()

    const websiteMatch = notesText.match(/Website:\s*([^\s\n\r]+)/i)
    if (websiteMatch) {
      let wUrl = websiteMatch[1].trim()
      if (wUrl && wUrl !== "N/A") {
        if (!wUrl.startsWith("http://") && !wUrl.startsWith("https://")) {
          wUrl = `https://${wUrl}`
        }
        companyWebsite = wUrl
      }
    }

    const employeesMatch = notesText.match(/Employees:\s*([^\n\r]+)/i)
    if (employeesMatch && employeesMatch[1].trim() !== "N/A") {
      companyEmployees = employeesMatch[1].trim()
    }
    const sizeMatch = notesText.match(/Company Size:\s*([^\n\r]+)/i)
    if (!companyEmployees && sizeMatch && sizeMatch[1].trim() !== "N/A") {
      companyEmployees = sizeMatch[1].trim()
    }
  }

  if (!contactName && deal.name?.includes(" — ")) {
    contactName = deal.name.split(" — ").slice(1).join(" — ").trim()
  }

  const companyName =
    deal.clientName ||
    (deal.name.includes(" — ") ? deal.name.split(" — ")[0].trim() : deal.name) ||
    "Prospect Account"

  const cleanNotes: string[] = []
  if (deal.notes) {
    deal.notes
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => {
        if (!l) return false
        if (/^Apollo\s*ID:/i.test(l)) return false
        if (/^Source:\s*Apollo/i.test(l)) return false
        if (/^(Title|Company|Industry|Location|LinkedIn|Email|Phone|Website|Employees):/i.test(l))
          return false
        return true
      })
      .forEach((l) => cleanNotes.push(l))
  }

  return {
    contactName,
    contactTitle,
    contactEmail,
    contactPhone,
    linkedinUrl,
    location,
    companyName,
    companyWebsite,
    companyIndustry,
    companyEmployees,
    cleanNotes,
  }
}

type DealDetailsSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  deal: Opportunity | null
  nextStage?: string | null
  onMoveStage?: (deal: Opportunity, nextStage: string) => void
  onSendEmail?: (deal: Opportunity) => void
  onEdit?: (deal: Opportunity) => void
  onEnrich?: (deal: Opportunity) => Promise<void>
  enriching?: boolean
}

export function DealDetailsSheet({
  open,
  onOpenChange,
  deal,
  nextStage,
  onMoveStage,
  onSendEmail,
  onEdit,
  onEnrich,
  enriching,
}: DealDetailsSheetProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  if (!deal) return null

  const profile = parseDealProfile(deal)

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(label)
    toast.success(`${label} copied to clipboard`)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const initials = profile.contactName
    ? profile.contactName
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : profile.companyName.slice(0, 2).toUpperCase()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-card border-l border-border shadow-2xl"
      >
        {/* Header */}
        <SheetHeader className="p-6 border-b border-border bg-card pr-12 shrink-0">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-[#270045] to-[#7a5cc2] text-white flex items-center justify-center font-sora font-bold text-base shadow-sm shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="font-sora text-xl font-bold text-foreground truncate">
                  {profile.contactName || profile.companyName}
                </SheetTitle>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5",
                    deal.stage === "won"
                      ? "border-success/40 bg-success/15 text-success"
                      : deal.stage === "lost"
                      ? "border-destructive/40 bg-destructive/15 text-destructive"
                      : "border-sky-500/40 bg-sky-500/10 text-sky-400"
                  )}
                >
                  {deal.stage}
                </Badge>
              </div>

              {profile.contactTitle && (
                <p className="text-xs font-medium text-muted-foreground mt-0.5 truncate">
                  {profile.contactTitle}
                </p>
              )}

              <p className="text-xs font-semibold text-primary/90 mt-1 flex items-center gap-1.5 truncate">
                <BuildingIcon className="size-3 shrink-0" />
                {profile.companyName}
              </p>
            </div>
          </div>
          <SheetDescription className="sr-only">
            Complete contact and prospect profile details
          </SheetDescription>
        </SheetHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Contact Actions Banner */}
          <div className="flex items-center gap-2 flex-wrap">
            {profile.contactEmail && onSendEmail ? (
              <Button
                size="sm"
                className="flex-1 h-9 bg-sky-600 hover:bg-sky-500 text-white font-medium gap-2 text-xs rounded-xl shadow-xs"
                onClick={() => {
                  onOpenChange(false)
                  onSendEmail(deal)
                }}
              >
                <MailIcon className="size-3.5" />
                Send Outreach Email
              </Button>
            ) : onEnrich ? (
              <Button
                size="sm"
                disabled={enriching}
                className="flex-1 h-9 bg-sky-600 hover:bg-sky-500 text-white font-medium gap-2 text-xs rounded-xl shadow-xs"
                onClick={() => void onEnrich(deal)}
              >
                {enriching ? <Loader2Icon className="size-3.5 animate-spin" /> : <SparklesIcon className="size-3.5" />}
                Reveal Email & Phone
              </Button>
            ) : null}

            {profile.linkedinUrl && (
              <a
                href={profile.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="View LinkedIn Profile"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-9 px-3.5 border-border hover:bg-surface-alt text-xs font-medium gap-2 rounded-xl"
                )}
              >
                <svg className="size-3.5 fill-[#0A66C2]" viewBox="0 0 24 24">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                </svg>
                LinkedIn
                <ExternalLinkIcon className="size-3 text-muted-foreground" />
              </a>
            )}

            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                className="h-9 px-3 text-xs gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onOpenChange(false)
                  onEdit(deal)
                }}
              >
                <PencilIcon className="size-3.5" />
                Edit
              </Button>
            )}
          </div>

          {/* Section 1: Contact Details */}
          <div className="rounded-2xl border border-border bg-surface-alt/40 p-4 space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <UserIcon className="size-3.5 text-primary" />
              Contact Information
            </h4>

            <div className="grid gap-2.5 text-xs">
              {/* Email */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <MailIcon className="size-4 text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-medium">Email Address</p>
                    {profile.contactEmail ? (
                      <a
                        href={`mailto:${profile.contactEmail}`}
                        className="font-mono text-xs text-foreground hover:text-sky-400 hover:underline truncate block"
                      >
                        {profile.contactEmail}
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-muted-foreground italic text-xs">No email revealed</span>
                        {onEnrich && (
                          <button
                            type="button"
                            disabled={enriching}
                            onClick={() => void onEnrich(deal)}
                            className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 hover:underline inline-flex items-center gap-1"
                          >
                            {enriching ? <Loader2Icon className="size-3 animate-spin" /> : <SparklesIcon className="size-3" />}
                            Reveal from database
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {profile.contactEmail && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => handleCopy(profile.contactEmail!, "Email")}
                    title="Copy email"
                  >
                    {copiedField === "Email" ? (
                      <CheckIcon className="size-3.5 text-success" />
                    ) : (
                      <CopyIcon className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>

              {/* Phone */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-card border border-border/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <PhoneIcon className="size-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-medium">Direct Phone</p>
                    {profile.contactPhone ? (
                      <a
                        href={`tel:${profile.contactPhone}`}
                        className="font-mono text-xs text-foreground hover:text-primary hover:underline truncate block"
                      >
                        {profile.contactPhone}
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-muted-foreground italic text-xs">No phone revealed</span>
                        {onEnrich && (
                          <button
                            type="button"
                            disabled={enriching}
                            onClick={() => void onEnrich(deal)}
                            className="text-[11px] font-semibold text-sky-400 hover:text-sky-300 hover:underline inline-flex items-center gap-1"
                          >
                            {enriching ? <Loader2Icon className="size-3 animate-spin" /> : <SparklesIcon className="size-3" />}
                            Reveal
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {profile.contactPhone && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => handleCopy(profile.contactPhone!, "Phone")}
                    title="Copy phone"
                  >
                    {copiedField === "Phone" ? (
                      <CheckIcon className="size-3.5 text-success" />
                    ) : (
                      <CopyIcon className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>

              {/* Location */}
              {profile.location && (
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-card border border-border/60">
                  <MapPinIcon className="size-4 text-rose-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">Location</p>
                    <p className="text-xs text-foreground font-medium">{profile.location}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Company Details */}
          <div className="rounded-2xl border border-border bg-surface-alt/40 p-4 space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <BuildingIcon className="size-3.5 text-primary" />
              Company Intelligence
            </h4>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-card border border-border/60 col-span-2">
                <p className="text-[10px] text-muted-foreground font-medium">Organization</p>
                <p className="text-xs font-bold text-foreground mt-0.5">{profile.companyName}</p>
              </div>

              {profile.companyIndustry && (
                <div className="p-2.5 rounded-xl bg-card border border-border/60">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <BriefcaseIcon className="size-3 text-muted-foreground" />
                    Industry
                  </p>
                  <p className="text-xs font-semibold text-foreground mt-0.5 truncate">
                    {profile.companyIndustry}
                  </p>
                </div>
              )}

              {profile.companyEmployees && (
                <div className="p-2.5 rounded-xl bg-card border border-border/60">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <UsersIcon className="size-3 text-muted-foreground" />
                    Company Size
                  </p>
                  <p className="text-xs font-semibold text-foreground mt-0.5 truncate">
                    {profile.companyEmployees} employees
                  </p>
                </div>
              )}

              {profile.companyWebsite && (
                <div className="p-2.5 rounded-xl bg-card border border-border/60 col-span-2 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                      <GlobeIcon className="size-3 text-muted-foreground" />
                      Website
                    </p>
                    <a
                      href={profile.companyWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline truncate block mt-0.5"
                    >
                      {profile.companyWebsite.replace(/^https?:\/\//i, "")}
                    </a>
                  </div>
                  <a
                    href={profile.companyWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon-xs" }),
                      "size-7 shrink-0 text-muted-foreground hover:text-foreground"
                    )}
                    title="Open website"
                  >
                    <ExternalLinkIcon className="size-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Commercials & Pipeline Details */}
          <div className="rounded-2xl border border-border bg-surface-alt/40 p-4 space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <SparklesIcon className="size-3.5 text-primary" />
              Deal & Pipeline Status
            </h4>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-card border border-border/60">
                <p className="text-[10px] text-muted-foreground font-medium">Estimated Value</p>
                <p className="font-sora text-sm font-bold text-foreground mt-0.5">
                  {deal.value > 0
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(deal.value)
                    : "TBD"}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-card border border-border/60">
                <p className="text-[10px] text-muted-foreground font-medium">Win Probability</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm font-bold text-foreground">{deal.probability}%</p>
                  <div className="flex-1 bg-surface-alt rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, deal.probability))}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-card border border-border/60">
                <p className="text-[10px] text-muted-foreground font-medium">Owner</p>
                <p className="text-xs font-semibold text-foreground mt-0.5 truncate">
                  {deal.owner || "Unassigned"}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-card border border-border/60">
                <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                  <CalendarIcon className="size-3 text-muted-foreground" />
                  Expected Close
                </p>
                <p className="text-xs font-semibold text-foreground mt-0.5">
                  {deal.expectedClose
                    ? new Date(deal.expectedClose).toLocaleDateString()
                    : "Not specified"}
                </p>
              </div>
            </div>

            {deal.nextStep && (
              <div className="p-2.5 rounded-xl bg-card border border-border/60 text-xs">
                <p className="text-[10px] text-muted-foreground font-medium">Next Action</p>
                <p className="text-xs font-semibold text-foreground mt-0.5">{deal.nextStep}</p>
              </div>
            )}
          </div>

          {/* Section 4: Context / Additional Notes */}
          {profile.cleanNotes.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface-alt/40 p-4 space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Notes & Intelligence
              </h4>
              <div className="p-3 rounded-xl bg-card border border-border/60 text-xs leading-relaxed space-y-1">
                {profile.cleanNotes.map((noteLine, idx) => (
                  <p key={idx} className="text-muted-foreground">
                    {noteLine}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <SheetFooter className="p-4 border-t border-border bg-surface-alt/40 flex flex-row items-center justify-between gap-2 shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            {nextStage && onMoveStage && (
              <Button
                type="button"
                className="bg-[#270045] hover:bg-[#3a006b] text-white text-xs font-medium gap-1.5 h-9 rounded-xl shadow-xs"
                onClick={() => {
                  onOpenChange(false)
                  onMoveStage(deal, nextStage)
                }}
              >
                <span>Move to {nextStage}</span>
                <ArrowRightIcon className="size-3.5" />
              </Button>
            )}

            {profile.contactEmail && onSendEmail && (
              <Button
                type="button"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 text-xs gap-2 h-9 rounded-xl"
                onClick={() => {
                  onOpenChange(false)
                  onSendEmail(deal)
                }}
              >
                <MailIcon className="size-3.5" />
                Dispatch Email
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
