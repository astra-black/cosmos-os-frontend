import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { ArrowRightIcon, CheckCircle2Icon, Clock3Icon, FileTextIcon, ShieldCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getVendorSharedQuote, submitVendorSharedQuote } from "@/lib/api/agency"
import type { VendorSharedQuote } from "@/types/agency"

export function VendorQuotePage() {
  const { token = "" } = useParams()
  const [quote, setQuote] = useState<VendorSharedQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [response, setResponse] = useState("")
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let active = true
    void getVendorSharedQuote(token).then((result) => { if (active) setQuote(result.data) }).catch((err: Error) => { if (active) setError(err.message || "This quote link is no longer available.") }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  async function submit() {
    if (!amount || !response.trim()) return
    setBusy(true)
    try { await submitVendorSharedQuote(token, { amount: Number(amount), currency, response: response.trim() }); setSubmitted(true); toast.success("Your quote was submitted") }
    catch (err) { toast.error(err instanceof Error ? err.message : "Quote response could not be submitted") }
    finally { setBusy(false) }
  }

  return <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(141,82,244,.13),transparent_52%)]" />
    <div className="relative w-full max-w-2xl">
      <header className="mb-8 flex items-center justify-between"><div className="font-display text-sm font-semibold tracking-[.18em]">COSMOS <span className="text-muted-foreground">· VENDOR PORTAL</span></div><Badge variant="outline" className="gap-1.5"><ShieldCheckIcon className="size-3" />Secure request</Badge></header>
      {loading ? <Card className="h-72 animate-pulse" /> : error ? <Card className="p-8 text-center"><FileTextIcon className="mx-auto size-8 text-muted-foreground" /><h1 className="mt-4 font-display text-xl font-semibold">Quote link unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p></Card> : quote ? <Card className="overflow-hidden">
        <div className="border-b bg-muted/30 px-6 py-5 sm:px-8"><p className="text-xs uppercase tracking-wider text-muted-foreground">{quote.agencyName} · {quote.projectName}</p><h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">{quote.title}</h1><p className="mt-1 text-sm text-muted-foreground">Prepared for {quote.vendorName}</p></div>
        <div className="grid gap-6 px-6 py-6 sm:px-8 sm:py-8">
          {quote.request ? <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Scope requested</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{quote.request}</p></div> : null}
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3Icon className="size-3.5" /> Link expires {new Date(quote.expiresAt).toLocaleString()}{quote.dueAt ? ` · requested by ${new Date(quote.dueAt).toLocaleDateString()}` : ""}</div>
          {submitted || quote.status === "submitted" ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-5"><div className="flex items-center gap-2 font-medium"><CheckCircle2Icon className="size-4 text-emerald-500" />Quote response received</div><p className="mt-1 text-sm text-muted-foreground">Thanks. Your response has been shared with {quote.agencyName}.</p></div> : <form className="grid gap-5 border-t pt-6" onSubmit={(event) => {event.preventDefault(); void submit()}}>
            <div><h2 className="font-display text-lg font-semibold">Your quote</h2><p className="mt-1 text-sm text-muted-foreground">Only this request and your response are shared with the agency.</p></div>
            <div className="grid gap-4 sm:grid-cols-[130px_1fr]"><div className="grid gap-1.5"><Label htmlFor="currency">Currency</Label><select id="currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className="h-9 rounded-lg border bg-background px-3 text-sm"><option>USD</option><option>EUR</option><option>GBP</option><option>INR</option><option>AED</option><option>CAD</option><option>AUD</option></select></div><div className="grid gap-1.5"><Label htmlFor="amount">Total amount</Label><Input id="amount" type="number" min="0" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div></div>
            <div className="grid gap-1.5"><Label htmlFor="response">Notes and assumptions</Label><textarea id="response" required rows={5} value={response} onChange={(event) => setResponse(event.target.value)} className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Add inclusions, exclusions, schedule, or any assumptions." /></div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="max-w-sm text-xs leading-relaxed text-muted-foreground">Submitting sends this quote to the requesting agency. The link cannot open other records.</p><Button type="submit" disabled={busy || !amount || !response.trim()}>{busy ? "Submitting…" : "Submit quote"}<ArrowRightIcon className="size-4" /></Button></div>
          </form>}
        </div>
      </Card> : null}
      <p className="mt-6 text-center text-xs text-muted-foreground">This secure page is limited to one vendor quote request.</p>
    </div>
  </main>
}
