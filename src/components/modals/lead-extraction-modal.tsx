import { useState, useEffect } from "react"
import { BotIcon, Loader2Icon, SearchIcon, SendIcon, SparklesIcon, FilterIcon, CheckIcon, CheckSquareIcon, SquareIcon, BarChart3Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  searchApolloContacts,
  syncContactsToAirtable,
  filterContactsByEmailStatus,
  getOutreachUsage,
  type ApolloContact,
  type ApolloSearchParams,
  type SyncResult,
} from "@/lib/api/outreach"
import { ApiError } from "@/lib/api/client"

type Step = "search" | "results" | "syncing" | "complete"

type LeadExtractionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (result: SyncResult) => void
}

export function LeadExtractionModal({ open, onOpenChange, onSuccess }: LeadExtractionModalProps) {
  const [step, setStep] = useState<Step>("search")
  const [searching, setSearching] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [addToPipeline, setAddToPipeline] = useState(true)
  const [searchParams, setSearchParams] = useState<ApolloSearchParams>({
    perPage: 50,
  })
  const [results, setResults] = useState<ApolloContact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [emailFilter, setEmailFilter] = useState<"all" | "verified" | "personal" | "professional">("verified")
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number; percentage: number } | null>(null)

  useEffect(() => {
    if (open) {
      getOutreachUsage()
        .then((res) => setUsage(res.data))
        .catch(() => setUsage(null))
    }
  }, [open])

  async function handleSearch() {
    setSearching(true)
    try {
      const res = await searchApolloContacts(searchParams)
      setResults(res.data.contacts || [])
      setStep("results")
      toast.success(`Found ${res.data.contacts?.length || 0} contacts`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to search contacts")
    } finally {
      setSearching(false)
    }
  }

  async function handleFilter() {
    try {
      const res = await filterContactsByEmailStatus(results, emailFilter)
      setResults(res.data || [])
      toast.success(`Filtered to ${res.data?.length || 0} contacts`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to filter contacts")
    }
  }

  function toggleContactSelection(contactId: string) {
    const newSelected = new Set(selectedContacts)
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId)
    } else {
      newSelected.add(contactId)
    }
    setSelectedContacts(newSelected)
  }

  function toggleSelectAll() {
    if (selectedContacts.size === results.length) {
      setSelectedContacts(new Set())
    } else {
      setSelectedContacts(new Set(results.map((c) => c.id)))
    }
  }

  function CustomCheckbox({ checked, onCheckedChange, id }: { checked: boolean; onCheckedChange: (checked: boolean) => void; id?: string }) {
    return (
      <button
        type="button"
        id={id}
        onClick={() => onCheckedChange(!checked)}
        className="size-4 rounded border border-border flex items-center justify-center hover:bg-surface-alt transition-colors"
      >
        {checked ? <CheckSquareIcon className="size-3.5 text-primary" /> : <SquareIcon className="size-3.5 text-muted-foreground" />}
      </button>
    )
  }

  async function handleSync() {
    const contactsToSync = results.filter((c) => selectedContacts.has(c.id))
    if (contactsToSync.length === 0) {
      toast.error("No contacts selected")
      return
    }

    setSyncing(true)
    setStep("syncing")
    try {
      const res = await syncContactsToAirtable(contactsToSync, "contacts", addToPipeline)
      setSyncResult(res.data)
      setStep("complete")
      onSuccess?.(res.data)
      toast.success(
        res.data.opportunitiesCreated
          ? `Synced ${res.data.synced} contacts & added ${res.data.opportunitiesCreated} leads to CRM Pipeline`
          : `Synced ${res.data.synced} contacts`
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to sync contacts")
      setStep("results")
    } finally {
      setSyncing(false)
    }
  }

  function reset() {
    setStep("search")
    setResults([])
    setSelectedContacts(new Set())
    setSyncResult(null)
    setSearchParams({ perPage: 50 })
  }

  function handleClose() {
    onOpenChange(false)
    setTimeout(reset, 300)
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col h-full bg-card border-l border-border shadow-2xl"
      >
        <SheetHeader className="p-6 border-b border-border bg-card pr-12 shrink-0">
          <SheetTitle className="flex items-center gap-2 font-sora text-xl font-bold text-foreground">
            <SparklesIcon className="size-5 text-sky-400" />
            Lead Extraction
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-1">
            Search for contacts using Apollo intelligence, verify email status, and sync directly into your CRM database.
          </SheetDescription>
          {usage && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              <BarChart3Icon className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Monthly usage:</span>
              <span className="font-medium">{usage.used} / {usage.limit}</span>
              <span className="text-muted-foreground">({usage.percentage}%)</span>
              <span className="text-muted-foreground">• {usage.remaining} remaining</span>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {step === "search" && (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="search-keywords">Keywords</Label>
                <Input
                  id="search-keywords"
                  placeholder="e.g., marketing director, SaaS, B2B"
                  value={searchParams.keywords || ""}
                  onChange={(e) => setSearchParams({ ...searchParams, keywords: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="search-titles">Job Titles (comma-separated)</Label>
                <Input
                  id="search-titles"
                  placeholder="e.g., Marketing Director, CEO, VP Sales"
                  value={searchParams.titles?.join(", ") || ""}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      titles: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="search-industries">Industries (comma-separated)</Label>
                <Input
                  id="search-industries"
                  placeholder="e.g., Technology, Healthcare, Finance"
                  value={searchParams.industries?.join(", ") || ""}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      industries: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="search-locations">Locations (comma-separated)</Label>
                <Input
                  id="search-locations"
                  placeholder="e.g., United States, San Francisco, New York"
                  value={searchParams.locations?.join(", ") || ""}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      locations: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                    })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="search-company-names">Company Names (comma-separated)</Label>
                <Input
                  id="search-company-names"
                  placeholder="e.g., Google, Microsoft, Stripe"
                  value={searchParams.companyNames?.join(", ") || ""}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      companyNames: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                    })
                  }
                />
              </div>

              <Button
                type="button"
                onClick={() => void handleSearch()}
                disabled={searching}
                className="bg-sky-600 hover:bg-sky-500 text-white gap-2 w-full"
              >
                {searching ? <Loader2Icon className="size-4 animate-spin" /> : <SearchIcon className="size-4" />}
                Search Contacts
              </Button>
            </div>
          )}

          {step === "results" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CustomCheckbox
                    id="select-all"
                    checked={selectedContacts.size === results.length && results.length > 0}
                    onCheckedChange={() => toggleSelectAll()}
                  />
                  <Label htmlFor="select-all" className="text-sm">
                    Select All ({selectedContacts.size} selected)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={emailFilter}
                    onChange={(e) => setEmailFilter(e.target.value as any)}
                    className="h-8 text-xs"
                  >
                    <option value="all">All Emails</option>
                    <option value="verified">Verified Only</option>
                    <option value="personal">Personal</option>
                    <option value="professional">Professional</option>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleFilter()}
                    disabled={results.length === 0}
                  >
                    <FilterIcon className="size-3 mr-1" />
                    Filter
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {results.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No contacts found. Try adjusting your search criteria.
                  </div>
                ) : (
                  results.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-surface-alt/50 transition-colors"
                    >
                      <CustomCheckbox
                        id={`contact-${contact.id}`}
                        checked={selectedContacts.has(contact.id)}
                        onCheckedChange={() => toggleContactSelection(contact.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`contact-${contact.id}`} className="font-medium text-sm truncate">
                            {contact.first_name} {contact.last_name_obfuscated || contact.last_name}
                          </Label>
                          {contact.has_email && (
                            <Badge variant="success" className="text-[10px]">
                              Email Available
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{contact.title}</p>
                        <p className="text-xs text-muted-foreground">{contact.organization?.name}</p>
                        {contact.has_direct_phone === "Yes" && (
                          <p className="text-xs text-sky-400">Direct phone available</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Option to create CRM Pipeline Leads */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-sky-500/20 bg-sky-500/5">
                <CustomCheckbox
                  id="add-to-pipeline"
                  checked={addToPipeline}
                  onCheckedChange={setAddToPipeline}
                />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <Label htmlFor="add-to-pipeline" className="text-xs font-semibold cursor-pointer text-foreground">
                    Add directly to CRM Pipeline (as new Leads)
                  </Label>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Creates active deals in the "Lead" stage on your CRM Kanban board so your sales team can qualify and outreach immediately.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep("search")} className="flex-1">
                  Back to Search
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSync()}
                  disabled={selectedContacts.size === 0}
                  className="flex-1 bg-sky-600 hover:bg-sky-500 text-white gap-2 font-medium"
                >
                  <SendIcon className="size-4" />
                  Sync {selectedContacts.size} {addToPipeline ? "to Pipeline" : "to Contacts"}
                </Button>
              </div>
            </div>
          )}

          {step === "syncing" && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <Loader2Icon className="size-12 text-sky-400 animate-spin" />
              <div className="text-center">
                <p className="font-medium">Syncing contacts to CRM</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please wait while we sync {selectedContacts.size} contacts and create pipeline leads...
                </p>
              </div>
            </div>
          )}

          {step === "complete" && syncResult && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <div className="size-12 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckIcon className="size-6 text-success" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-lg">Sync Complete</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Successfully synced {syncResult.synced} contacts
                    {syncResult.opportunitiesCreated ? ` and created ${syncResult.opportunitiesCreated} CRM pipeline leads` : ''}
                  </p>
                </div>
              </div>

              <div className="grid gap-2 p-4 rounded-lg bg-surface-alt/50">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Contacts Synced</span>
                  <span className="font-medium text-success">{syncResult.synced}</span>
                </div>
                {typeof syncResult.opportunitiesCreated === "number" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pipeline Leads Created</span>
                    <span className="font-medium text-sky-400 font-semibold">{syncResult.opportunitiesCreated}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Skipped</span>
                  <span className="font-medium">{syncResult.skipped}</span>
                </div>
                {syncResult.errors.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Errors</span>
                    <span className="font-medium text-destructive">{syncResult.errors.length}</span>
                  </div>
                )}
              </div>

              {syncResult.errors.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Errors</Label>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {syncResult.errors.map((err, idx) => (
                      <div key={idx} className="text-xs text-destructive p-2 rounded bg-destructive/10">
                        {err.email}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button type="button" onClick={reset} className="w-full">
                Search More Contacts
              </Button>
            </div>
          )}
        </div>

        <SheetFooter className="p-4 border-t border-border bg-surface-alt/40 flex flex-row items-center justify-end gap-2 shrink-0">
          <Button type="button" variant="outline" onClick={handleClose}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
