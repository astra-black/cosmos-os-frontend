import { Link } from "react-router-dom"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const domainHints: Record<
  string,
  { title: string; notes: string }
> = {
  portfolio: {
    title: "Portfolio",
    notes: "Review client work, delivery totals, and account context in one place.",
  },
  cues: {
    title: "Cues & Timeline",
    notes: "Pick an event first, then manage cue timing and execution actions.",
  },
  crew: {
    title: "Crew & Departments",
    notes: "Departments and crew are scoped per event.",
  },
  incidents: {
    title: "Incidents",
    notes: "Track reported issues, ownership, escalation, and resolution status.",
  },
  analytics: {
    title: "Analytics",
    notes: "Review event performance, readiness, completion, and activity trends.",
  },
  settings: {
    title: "Settings",
    notes: "Manage workspace preferences, access, and connected service settings.",
  },
}

export function DomainPlaceholderPage({ domain }: { domain: keyof typeof domainHints }) {
  const meta = domainHints[domain]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
        <p className="text-muted-foreground text-sm">This workspace area is ready for the next screen.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{meta.title}</CardTitle>
          <CardDescription>Planned workspace view</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground flex flex-col gap-3 text-sm">
          <p>{meta.notes}</p>
          <p>
            Nav is wired. Detail screens for this domain can be filled next —
            start from the <Link className="text-primary underline" to="/">dashboard</Link>{" "}
            or <Link className="text-primary underline" to="/events">events</Link> list.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
