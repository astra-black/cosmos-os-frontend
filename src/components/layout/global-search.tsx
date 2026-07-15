import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { globalSearch } from "@/lib/api/platform"
import { cn } from "@/lib/utils"

type Hit = {
  type: string
  id: string
  title: string
  subtitle?: string
  href: string
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (!open || !q.trim()) {
      setHits([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await globalSearch(q.trim())
        if (!cancelled) setHits((res.data as Hit[]) ?? [])
      } catch {
        if (!cancelled) setHits([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q, open])

  function go(href: string) {
    setOpen(false)
    setQ("")
    navigate(href)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-muted-foreground hidden h-8 gap-2 md:inline-flex"
        onClick={() => setOpen(true)}
      >
        <SearchIcon className="size-3.5" />
        <span className="text-xs">Search</span>
        <kbd className="bg-muted rounded px-1 font-mono text-[10px]">⌘K</kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <SearchIcon className="size-4" />
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background border-border w-full max-w-lg overflow-hidden rounded-xl border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <SearchIcon className="text-muted-foreground size-4" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search clients, projects, assets, pages…"
                className="border-0 shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {loading ? (
                <p className="text-muted-foreground px-2 py-6 text-center text-sm">Searching…</p>
              ) : hits.length === 0 ? (
                <p className="text-muted-foreground px-2 py-6 text-center text-sm">
                  {q.trim() ? "No results" : "Type to search the Agency OS"}
                </p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {hits.map((hit) => (
                    <li key={`${hit.type}-${hit.id}`}>
                      <button
                        type="button"
                        className={cn(
                          "hover:bg-muted flex w-full flex-col rounded-lg px-3 py-2 text-left text-sm",
                        )}
                        onClick={() => go(hit.href)}
                      >
                        <span className="font-medium">{hit.title}</span>
                        <span className="text-muted-foreground text-xs capitalize">
                          {hit.type}
                          {hit.subtitle ? ` · ${hit.subtitle}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
