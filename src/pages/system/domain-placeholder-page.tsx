import { Link } from "react-router-dom"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const domainHints: Record<
  string,
  { title: string; endpoint: string; notes: string }
> = {
  portfolio: {
    title: "Portfolio",
    endpoint: "GET /api/v1/agency/portfolio/:clientId",
    notes: "Requires JWT + x-cosmos-api-key. Live JS controller is still a stub.",
  },
  cues: {
    title: "Cues & Timeline",
    endpoint: "GET /api/v1/agency/cues/events/:eventId/cues",
    notes: "Pick an event first, then load cue timeline + execution actions.",
  },
  crew: {
    title: "Crew & Departments",
    endpoint: "GET /api/v1/agency/departments/events/:eventId/crew",
    notes: "Departments and crew are scoped per event.",
  },
  incidents: {
    title: "Incidents",
    endpoint: "GET /api/v1/agency/incidents/events/:eventId/incidents",
    notes: "Stats endpoint already powers the dashboard open-incident count.",
  },
  analytics: {
    title: "Analytics",
    endpoint: "GET /api/v1/agency/analytics/events/:eventId/analytics",
    notes: "Health score and cue completion feed the dashboard Event health card.",
  },
  settings: {
    title: "Settings",
    endpoint: "Auth + API key configuration",
    notes: "Tokens live in localStorage; API base URL and cosmos API key come from Vite env.",
  },
}

export function DomainPlaceholderPage({ domain }: { domain: keyof typeof domainHints }) {
  const meta = domainHints[domain]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
        <p className="text-muted-foreground text-sm">Domain placeholder — wire a full screen when ready</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Backend alignment</CardTitle>
          <CardDescription>{meta.endpoint}</CardDescription>
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
