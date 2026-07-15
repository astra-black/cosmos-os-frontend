import { useEffect, useState } from "react"
import { MessageSquareIcon, SendIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/auth"
import { createComment, listComments } from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import type { Comment } from "@/types/agency"

export function CommentsPanel({
  entityType,
  entityId,
  title = "Comments",
}: {
  entityType: string
  entityId: string
  title?: string
}) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  async function reload() {
    if (!entityId) return
    const res = await listComments(entityType, entityId)
    setComments(res.data ?? [])
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        await reload()
      } catch {
        if (!cancelled) setComments([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId])

  async function send() {
    if (!text.trim() || !entityId) return
    setSending(true)
    try {
      await createComment({
        entityType,
        entityId,
        body: text.trim(),
        author: user?.name || user?.email || "You",
      })
      setText("")
      await reload()
      toast.success("Comment added")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to comment")
    } finally {
      setSending(false)
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquareIcon className="size-4" />
        {title}
      </div>
      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : comments.length === 0 ? (
        <p className="text-muted-foreground text-xs">No comments yet.</p>
      ) : (
        <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
          {comments.map((c) => (
            <li key={c.commentId} className="bg-muted/40 rounded-lg px-3 py-2 text-sm">
              <div className="flex justify-between gap-2 text-[11px]">
                <span className="font-medium">{c.author}</span>
                <span className="text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-sm leading-snug">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="Write a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
        />
        <Button size="sm" disabled={sending || !text.trim()} onClick={send}>
          <SendIcon className="size-3.5" />
        </Button>
      </div>
    </Card>
  )
}
