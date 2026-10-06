import { useState } from "react"
import { EyeIcon, EyeOffIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { setClientItemVisibility, type ClientShareableItem } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { cn } from "@/lib/utils"

type ShareWithClientToggleProps = {
  clientId: string
  entityType: ClientShareableItem["entityType"]
  entityId: string
  clientVisible?: boolean
  onChange?: (clientVisible: boolean) => void
  className?: string
  size?: "sm" | "default"
}

/** Agency-side control: opt an item into the client portal (private by default). */
export function ShareWithClientToggle({
  clientId,
  entityType,
  entityId,
  clientVisible = false,
  onChange,
  className,
  size = "sm",
}: ShareWithClientToggleProps) {
  const [visible, setVisible] = useState(Boolean(clientVisible))
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (!clientId || !entityId) return
    setBusy(true)
    const next = !visible
    try {
      await setClientItemVisibility(clientId, { id: entityId, entityType }, next)
      setVisible(next)
      onChange?.(next)
      toast.success(next ? "Shared with client portal" : "Hidden from client portal")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update sharing")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant={visible ? "default" : "outline"}
      disabled={busy || !clientId}
      onClick={() => void toggle()}
      className={cn(
        "gap-1.5",
        visible ? "bg-emerald-700 hover:bg-emerald-600" : undefined,
        className,
      )}
      title={visible ? "Visible in client portal — click to hide" : "Private — click to share with client"}
    >
      {busy ? (
        <Loader2Icon className="size-3.5 animate-spin" />
      ) : visible ? (
        <EyeIcon className="size-3.5" />
      ) : (
        <EyeOffIcon className="size-3.5" />
      )}
      {visible ? "Shared" : "Share with client"}
    </Button>
  )
}
