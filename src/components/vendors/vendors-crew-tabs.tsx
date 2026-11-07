import { Link } from "react-router-dom"

import { cn } from "@/lib/utils"

type TabId = "vendors" | "crew" | "groups"

type VendorsCrewTabsProps = {
  active: TabId
  vendorCount?: number | string
  crewCount?: number | string
}

/** Figma 00.10 · 117–120 shared shell tabs (Vendors / Crew / Saved Groups). */
export function VendorsCrewTabs({
  active,
  vendorCount = "—",
  crewCount = "—",
}: VendorsCrewTabsProps) {
  return (
    <div className="cosmos-vc-tabs" role="tablist" aria-label="Vendors and crew">
      <Link
        to="/vendors"
        role="tab"
        aria-selected={active === "vendors"}
        className={cn(active === "vendors" && "is-active")}
      >
        Vendors
        <span>{String(vendorCount)}</span>
      </Link>
      <Link
        to="/crew"
        role="tab"
        aria-selected={active === "crew"}
        className={cn(active === "crew" && "is-active")}
      >
        Crew
        <span>{String(crewCount)}</span>
      </Link>
      <button
        type="button"
        role="tab"
        aria-selected={false}
        disabled
        title="Saved Groups are not in the Agency OS API yet"
        className="is-unavailable"
      >
        Saved Groups
        <span>—</span>
      </button>
    </div>
  )
}
