import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangleIcon,
  HashIcon,
  LockIcon,
  MessageSquareIcon,
  PlusIcon,
  SendIcon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  createConversation,
  createTaskFromMessage,
  getConversation,
  listConversationMessages,
  listConversations,
  listProjects,
  listTeamMembers,
  markConversationRead,
  normalizeProjects,
  postConversationMessage,
  previewConversationMentions,
} from "@/lib/api/agency"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/auth"
import { normalizeRole } from "@/lib/rbac"
import { cn } from "@/lib/utils"
import type {
  ConversationAudience,
  ConversationMessage,
  ConversationSummary,
  Project,
  RestrictedMention,
  TeamMember,
} from "@/types/agency"

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("")
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  return isYesterday ? `Yesterday ${time}` : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function audienceChip(audience: ConversationAudience) {
  switch (audience) {
    case "CLIENT":
      return { label: "Visible To Client", tone: "client" as const }
    case "VENDOR":
      return { label: "Vendor", tone: "vendor" as const }
    case "ANNOUNCEMENTS":
      return { label: "Announcements", tone: "announce" as const }
    default:
      return { label: "Internal", tone: "internal" as const }
  }
}

/** Parse @Name tokens against known team members for mention preview. */
function detectMentionIds(text: string, members: TeamMember[]): string[] {
  const ids: string[] = []
  for (const m of members) {
    if (!m.name) continue
    const re = new RegExp(`@${m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
    if (re.test(text)) ids.push(m.memberId)
  }
  return [...new Set(ids)]
}

function canUseMessaging(role: string | null | undefined) {
  const norm = normalizeRole(role)
  return ["admin", "pm", "producer", "ops", "creative"].includes(norm)
}

export function MessagesPage() {
  const { user } = useAuth()
  const canWrite = canUseMessaging(user?.role)
  const canCreateChannel = canUseMessaging(user?.role)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<Record<string, ConversationSummary[]>>({})
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ConversationSummary | null>(null)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [messagesCursor, setMessagesCursor] = useState<string | null>(null)
  const [messagesHasMore, setMessagesHasMore] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [threadRoot, setThreadRoot] = useState<ConversationMessage | null>(null)
  const [threadReplies, setThreadReplies] = useState<ConversationMessage[]>([])
  const [threadCursor, setThreadCursor] = useState<string | null>(null)
  const [threadHasMore, setThreadHasMore] = useState(false)
  const [loadingOlderThread, setLoadingOlderThread] = useState(false)
  const [composer, setComposer] = useState("")
  const [threadComposer, setThreadComposer] = useState("")
  const [restricted, setRestricted] = useState<RestrictedMention[]>([])
  const [search, setSearch] = useState("")
  const [sending, setSending] = useState(false)

  const feedRef = useRef<HTMLDivElement | null>(null)
  const threadFeedRef = useRef<HTMLDivElement | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const loadGenRef = useRef(0)
  const threadGenRef = useRef(0)

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const [projects, setProjects] = useState<Project[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  const [newChannelOpen, setNewChannelOpen] = useState(false)
  const [channelName, setChannelName] = useState("")
  const [channelProjectId, setChannelProjectId] = useState("")
  const [channelAudience, setChannelAudience] = useState<ConversationAudience>("INTERNAL")
  const [channelMemberIds, setChannelMemberIds] = useState<string[]>([])
  const [creatingChannel, setCreatingChannel] = useState(false)

  const [taskOpen, setTaskOpen] = useState(false)
  const [taskSource, setTaskSource] = useState<ConversationMessage | null>(null)
  const [taskTitle, setTaskTitle] = useState("")
  const [taskProjectId, setTaskProjectId] = useState("")
  const [taskAssigneeId, setTaskAssigneeId] = useState("")
  const [taskDue, setTaskDue] = useState("")
  const [creatingTask, setCreatingTask] = useState(false)

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    const next: Record<string, ConversationSummary[]> = {}
    for (const [key, list] of Object.entries(groups)) {
      const matched = list.filter(
        (c) =>
          c.displayName.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.projectName || "").toLowerCase().includes(q),
      )
      if (matched.length) next[key] = matched
    }
    return next
  }, [groups, search])

  async function refreshList(selectId?: string | null) {
    const res = await listConversations()
    const data = res.data
    setConversations(data?.conversations || [])
    setGroups(data?.groups || {})
    const nextId =
      selectId ||
      activeId ||
      data?.conversations?.[0]?.conversationId ||
      null
    setActiveId(nextId)
    return nextId
  }

  async function loadConversation(conversationId: string, gen: number) {
    const [detailRes, messagesRes] = await Promise.all([
      getConversation(conversationId),
      listConversationMessages(conversationId),
    ])
    if (gen !== loadGenRef.current || activeIdRef.current !== conversationId) return

    const page = messagesRes.data
    setDetail(detailRes.data || null)
    setMessages(page?.items || [])
    setMessagesCursor(page?.nextCursor || null)
    setMessagesHasMore(Boolean(page?.hasMore))
    setThreadRoot(null)
    setThreadReplies([])
    setThreadCursor(null)
    setThreadHasMore(false)
    setRestricted([])
    setComposer("")
    void markConversationRead(conversationId).catch(() => undefined)

    // Pin to bottom after first page of latest messages.
    requestAnimationFrame(() => {
      const el = feedRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }

  async function loadOlderMessages() {
    if (!activeId || !messagesHasMore || !messagesCursor || loadingOlderMessages) return
    const conversationId = activeId
    const gen = loadGenRef.current
    const el = feedRef.current
    const prevHeight = el?.scrollHeight ?? 0
    const prevTop = el?.scrollTop ?? 0
    setLoadingOlderMessages(true)
    try {
      const res = await listConversationMessages(conversationId, { cursor: messagesCursor })
      if (gen !== loadGenRef.current || activeIdRef.current !== conversationId) return
      const page = res.data
      const older = page?.items || []
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.messageId))
        const unique = older.filter((m) => !seen.has(m.messageId))
        return [...unique, ...prev]
      })
      setMessagesCursor(page?.nextCursor || null)
      setMessagesHasMore(Boolean(page?.hasMore))
      requestAnimationFrame(() => {
        const feed = feedRef.current
        if (!feed) return
        feed.scrollTop = feed.scrollHeight - prevHeight + prevTop
      })
    } catch (err) {
      if (gen !== loadGenRef.current) return
      toast.error(err instanceof ApiError ? err.message : "Older messages could not be loaded")
    } finally {
      if (gen === loadGenRef.current) setLoadingOlderMessages(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      listConversations(),
      listProjects().catch(() => null),
      listTeamMembers().catch(() => null),
    ])
      .then(async ([convRes, projectsRes, membersRes]) => {
        if (cancelled) return
        const data = convRes.data
        setConversations(data?.conversations || [])
        setGroups(data?.groups || {})
        if (projectsRes) setProjects(normalizeProjects(projectsRes))
        if (membersRes?.data) setTeamMembers(membersRes.data)
        const first = data?.conversations?.[0]?.conversationId || null
        setActiveId(first)
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err instanceof ApiError
            ? err.message
            : "Messages could not be loaded. The messaging service may be unavailable.",
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!activeId) {
      setDetail(null)
      setMessages([])
      setMessagesCursor(null)
      setMessagesHasMore(false)
      return
    }
    const gen = ++loadGenRef.current
    let cancelled = false
    loadConversation(activeId, gen).catch((err) => {
      if (cancelled || gen !== loadGenRef.current) return
      toast.error(err instanceof ApiError ? err.message : "Conversation could not be loaded")
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  useEffect(() => {
    if (!activeId || !composer.trim()) {
      setRestricted([])
      return
    }
    const ids = detectMentionIds(composer, teamMembers)
    if (!ids.length) {
      setRestricted([])
      return
    }
    const handle = window.setTimeout(() => {
      previewConversationMentions(activeId, ids)
        .then((res) => setRestricted(res.data?.restrictedMentions || []))
        .catch(() => setRestricted([]))
    }, 250)
    return () => window.clearTimeout(handle)
  }, [composer, activeId, teamMembers])

  async function openThread(message: ConversationMessage) {
    if (!activeId) return
    const conversationId = activeId
    const gen = ++threadGenRef.current
    setThreadRoot(message)
    setThreadReplies([])
    setThreadCursor(null)
    setThreadHasMore(false)
    try {
      const res = await listConversationMessages(conversationId, {
        parentId: message.messageId,
      })
      if (gen !== threadGenRef.current || activeIdRef.current !== conversationId) return
      const page = res.data
      setThreadReplies(page?.items || [])
      setThreadCursor(page?.nextCursor || null)
      setThreadHasMore(Boolean(page?.hasMore))
      requestAnimationFrame(() => {
        const el = threadFeedRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    } catch (err) {
      if (gen !== threadGenRef.current) return
      toast.error(err instanceof ApiError ? err.message : "Thread could not be loaded")
    }
  }

  async function loadOlderThreadReplies() {
    if (
      !activeId ||
      !threadRoot ||
      !threadHasMore ||
      !threadCursor ||
      loadingOlderThread
    ) {
      return
    }
    const conversationId = activeId
    const parentId = threadRoot.messageId
    const gen = threadGenRef.current
    const el = threadFeedRef.current
    const prevHeight = el?.scrollHeight ?? 0
    const prevTop = el?.scrollTop ?? 0
    setLoadingOlderThread(true)
    try {
      const res = await listConversationMessages(conversationId, {
        parentId,
        cursor: threadCursor,
      })
      if (
        gen !== threadGenRef.current ||
        activeIdRef.current !== conversationId ||
        threadRoot?.messageId !== parentId
      ) {
        return
      }
      const page = res.data
      const older = page?.items || []
      setThreadReplies((prev) => {
        const seen = new Set(prev.map((m) => m.messageId))
        const unique = older.filter((m) => !seen.has(m.messageId))
        return [...unique, ...prev]
      })
      setThreadCursor(page?.nextCursor || null)
      setThreadHasMore(Boolean(page?.hasMore))
      requestAnimationFrame(() => {
        const feed = threadFeedRef.current
        if (!feed) return
        feed.scrollTop = feed.scrollHeight - prevHeight + prevTop
      })
    } catch (err) {
      if (gen !== threadGenRef.current) return
      toast.error(err instanceof ApiError ? err.message : "Older replies could not be loaded")
    } finally {
      if (gen === threadGenRef.current) setLoadingOlderThread(false)
    }
  }

  async function sendMessage(parentMessageId?: string) {
    if (!activeId) return
    const conversationId = activeId
    const text = (parentMessageId ? threadComposer : composer).trim()
    if (!text || sending) return
    setSending(true)
    try {
      const mentionMemberIds = detectMentionIds(text, teamMembers)
      const res = await postConversationMessage(conversationId, {
        body: text,
        parentMessageId,
        mentionMemberIds,
      })
      if (activeIdRef.current !== conversationId) return
      if (res.data?.restrictedMentions?.length) {
        setRestricted(res.data.restrictedMentions)
      }
      const posted = res.data?.message
      if (parentMessageId) {
        setThreadComposer("")
        if (posted) {
          setThreadReplies((prev) =>
            prev.some((m) => m.messageId === posted.messageId) ? prev : [...prev, posted],
          )
          setMessages((prev) =>
            prev.map((m) =>
              m.messageId === parentMessageId
                ? { ...m, replyCount: (m.replyCount || 0) + 1 }
                : m,
            ),
          )
        }
        requestAnimationFrame(() => {
          const el = threadFeedRef.current
          if (el) el.scrollTop = el.scrollHeight
        })
      } else {
        setComposer("")
        setRestricted([])
        if (posted) {
          setMessages((prev) =>
            prev.some((m) => m.messageId === posted.messageId) ? prev : [...prev, posted],
          )
        }
        requestAnimationFrame(() => {
          const el = feedRef.current
          if (el) el.scrollTop = el.scrollHeight
        })
      }
      await refreshList(conversationId)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Message could not be sent")
    } finally {
      setSending(false)
    }
  }

  async function submitNewChannel() {
    if (!channelName.trim() || !channelProjectId) {
      toast.error("Name and project are required")
      return
    }
    setCreatingChannel(true)
    try {
      const res = await createConversation({
        name: channelName.trim(),
        projectId: channelProjectId,
        audience: channelAudience,
        memberIds: channelMemberIds,
      })
      setNewChannelOpen(false)
      setChannelName("")
      setChannelMemberIds([])
      setChannelAudience("INTERNAL")
      const id = res.data?.conversationId
      await refreshList(id)
      if (id) setActiveId(id)
      toast.success("Channel created")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Channel could not be created")
    } finally {
      setCreatingChannel(false)
    }
  }

  function openCreateTask(message: ConversationMessage) {
    setTaskSource(message)
    setTaskTitle(message.body.slice(0, 120))
    setTaskProjectId(detail?.projectId || projects[0]?.projectId || "")
    setTaskAssigneeId("")
    setTaskDue("")
    setTaskOpen(true)
  }

  async function submitTask() {
    if (!taskSource || !taskTitle.trim() || !taskProjectId) {
      toast.error("Task title and project are required")
      return
    }
    setCreatingTask(true)
    try {
      const res = await createTaskFromMessage(taskSource.messageId, {
        title: taskTitle.trim(),
        projectId: taskProjectId,
        assigneeMemberId: taskAssigneeId || undefined,
        dueDate: taskDue || undefined,
        visibleTo: "Internal team only",
      })
      const createdTaskId = res.data?.task?.taskId
      toast.success("Task created and linked to the message")
      setTaskOpen(false)
      if (createdTaskId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === taskSource.messageId ? { ...m, createdTaskId } : m,
          ),
        )
        if (threadRoot?.messageId === taskSource.messageId) {
          setThreadRoot((prev) => (prev ? { ...prev, createdTaskId } : prev))
        }
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Task could not be created")
    } finally {
      setCreatingTask(false)
    }
  }

  function toggleChannelMember(memberId: string) {
    setChannelMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    )
  }

  const chip = detail ? audienceChip(detail.audience) : null

  if (loading) {
    return (
      <div className="cosmos-messages-page">
        <div className="cosmos-messages-page__title-row">
          <h1>Messages</h1>
        </div>
        <div className="cosmos-messages-layout">
          <Skeleton className="h-[70vh] rounded-xl" />
          <Skeleton className="h-[70vh] flex-1 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="cosmos-messages-page">
      <div className="cosmos-messages-page__title-row">
        <h1>Messages</h1>
        {canCreateChannel ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setNewChannelOpen(true)}
          >
            <PlusIcon />
            New Channel
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="cosmos-messages-page__error" role="alert">
          <p>{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <div className="cosmos-messages-layout">
        <aside className="cosmos-messages-channels">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages"
            aria-label="Search messages"
          />
          {Object.keys(filteredGroups).length === 0 ? (
            <div className="cosmos-messages-empty">
              <MessageSquareIcon />
              <p>
                {conversations.length === 0
                  ? "No conversations yet. Create a channel to start."
                  : "No channels match this search."}
              </p>
            </div>
          ) : (
            Object.entries(filteredGroups).map(([group, list]) => (
              <div key={group} className="cosmos-messages-channels__group">
                <div className="cosmos-messages-channels__group-label">{group}</div>
                <ul>
                  {list.map((c) => (
                    <li key={c.conversationId}>
                      <button
                        type="button"
                        className={cn(
                          "cosmos-messages-channel",
                          activeId === c.conversationId && "is-active",
                        )}
                        onClick={() => setActiveId(c.conversationId)}
                      >
                        {c.kind === "CHANNEL" ? (
                          c.audience === "INTERNAL" ? (
                            <LockIcon aria-hidden />
                          ) : (
                            <HashIcon aria-hidden />
                          )
                        ) : (
                          <span className="cosmos-messages-avatar" aria-hidden>
                            {initials(c.name)}
                          </span>
                        )}
                        <span className="cosmos-messages-channel__name">{c.displayName}</span>
                        {c.unreadCount > 0 ? (
                          <span className="cosmos-messages-unread">{c.unreadCount}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </aside>

        <section className="cosmos-messages-thread" aria-label="Conversation">
          {!detail ? (
            <div className="cosmos-messages-empty is-center">
              <p>Select a conversation to read messages.</p>
            </div>
          ) : (
            <>
              <header className="cosmos-messages-thread__head">
                <div>
                  <div className="cosmos-messages-thread__title">
                    <h2>{detail.displayName}</h2>
                    {chip ? (
                      <span className={cn("cosmos-messages-vis", `is-${chip.tone}`)}>
                        {chip.label}
                      </span>
                    ) : null}
                  </div>
                  <p>
                    {detail.memberCount ?? detail.members?.length ?? 0} members
                    {detail.audienceLabel ? ` · ${detail.audienceLabel}` : ""}
                  </p>
                </div>
              </header>

              <div className="cosmos-messages-feed" ref={feedRef}>
                {messagesHasMore ? (
                  <div className="cosmos-messages-feed__older">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loadingOlderMessages}
                      onClick={() => void loadOlderMessages()}
                    >
                      {loadingOlderMessages ? "Loading…" : "Load older messages"}
                    </Button>
                  </div>
                ) : null}
                {messages.length === 0 ? (
                  <div className="cosmos-messages-empty">
                    <p>No messages yet. Say hello to start the thread.</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <article key={m.messageId} className="cosmos-messages-bubble">
                      <div className="cosmos-messages-avatar" aria-hidden>
                        {initials(m.author?.name || "?")}
                      </div>
                      <div className="cosmos-messages-bubble__body">
                        <div className="cosmos-messages-bubble__meta">
                          <strong>{m.author?.name || "Unknown"}</strong>
                          {m.author?.title ? <span>{m.author.title}</span> : null}
                          <time dateTime={m.createdAt}>{formatWhen(m.createdAt)}</time>
                        </div>
                        <p>{m.body}</p>
                        {m.createdTaskId ? (
                          <p className="cosmos-messages-task-link">
                            Linked task · {m.createdTaskId.slice(0, 8)}…
                          </p>
                        ) : null}
                        <div className="cosmos-messages-bubble__actions">
                          <button type="button" onClick={() => openThread(m)}>
                            {m.replyCount > 0 ? `${m.replyCount} replies` : "Reply"}
                          </button>
                          {canWrite ? (
                            <button type="button" onClick={() => openCreateTask(m)}>
                              Create Task
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="cosmos-messages-composer">
                {restricted.length > 0 ? (
                  <div className="cosmos-messages-restricted" role="status">
                    <AlertTriangleIcon />
                    <span>{restricted[0].message}</span>
                  </div>
                ) : null}
                <div className="cosmos-messages-composer__box">
                  <textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder={`Message ${detail.displayName}`}
                    rows={2}
                    disabled={!canWrite || detail.audience === "ANNOUNCEMENTS"}
                  />
                  <div className="cosmos-messages-composer__bar">
                    {detail.audience === "ANNOUNCEMENTS" && detail.myRole !== "OWNER" ? (
                      <span className="cosmos-messages-hint">
                        Announcement channels are read-only for members.
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      size="icon"
                      disabled={!canWrite || !composer.trim() || sending}
                      onClick={() => void sendMessage()}
                      aria-label="Send message"
                    >
                      <SendIcon />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="cosmos-messages-side">
          {threadRoot ? (
            <div className="cosmos-messages-side__panel">
              <div className="cosmos-messages-side__head">
                <h3>Thread</h3>
                <button
                  type="button"
                  aria-label="Close thread"
                  onClick={() => {
                    threadGenRef.current += 1
                    setThreadRoot(null)
                    setThreadReplies([])
                    setThreadCursor(null)
                    setThreadHasMore(false)
                  }}
                >
                  <XIcon />
                </button>
              </div>
              <article className="cosmos-messages-bubble">
                <div className="cosmos-messages-avatar" aria-hidden>
                  {initials(threadRoot.author?.name || "?")}
                </div>
                <div className="cosmos-messages-bubble__body">
                  <div className="cosmos-messages-bubble__meta">
                    <strong>{threadRoot.author?.name}</strong>
                    <time dateTime={threadRoot.createdAt}>{formatWhen(threadRoot.createdAt)}</time>
                  </div>
                  <p>{threadRoot.body}</p>
                </div>
              </article>
              <div className="cosmos-messages-side__label">
                {threadReplies.length} {threadReplies.length === 1 ? "Reply" : "Replies"}
              </div>
              <div className="cosmos-messages-thread-feed" ref={threadFeedRef}>
                {threadHasMore ? (
                  <div className="cosmos-messages-feed__older">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loadingOlderThread}
                      onClick={() => void loadOlderThreadReplies()}
                    >
                      {loadingOlderThread ? "Loading…" : "Load older replies"}
                    </Button>
                  </div>
                ) : null}
                {threadReplies.map((r) => (
                  <article key={r.messageId} className="cosmos-messages-bubble">
                    <div className="cosmos-messages-avatar" aria-hidden>
                      {initials(r.author?.name || "?")}
                    </div>
                    <div className="cosmos-messages-bubble__body">
                      <div className="cosmos-messages-bubble__meta">
                        <strong>{r.author?.name}</strong>
                        <time dateTime={r.createdAt}>{formatWhen(r.createdAt)}</time>
                      </div>
                      <p>{r.body}</p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="cosmos-messages-composer__box is-compact">
                <Input
                  value={threadComposer}
                  onChange={(e) => setThreadComposer(e.target.value)}
                  placeholder="Reply in thread"
                  disabled={!canWrite}
                />
              </div>
              <div className="cosmos-messages-side__actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  title="Astrid summarize is not available in this foundation"
                >
                  Summarize
                </Button>
                {canWrite ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openCreateTask(threadRoot)}
                  >
                    <PlusIcon />
                    Create Task
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={!canWrite || !threadComposer.trim() || sending}
                  onClick={() => void sendMessage(threadRoot.messageId)}
                >
                  Reply
                </Button>
              </div>
            </div>
          ) : detail ? (
            <div className="cosmos-messages-side__panel">
              <div className="cosmos-messages-side__head">
                <h3>Details</h3>
              </div>
              <dl className="cosmos-messages-details">
                <div>
                  <dt>Audience</dt>
                  <dd>
                    {detail.audienceLabel}
                    {chip ? (
                      <span className={cn("cosmos-messages-vis", `is-${chip.tone}`)}>
                        {chip.label}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Linked to</dt>
                  <dd>{detail.projectName || "Not linked"}</dd>
                </div>
                <div>
                  <dt>Members</dt>
                  <dd>
                    <ul className="cosmos-messages-member-list">
                      {(detail.members || []).map((m) => (
                        <li key={m.memberId}>
                          <span className="cosmos-messages-avatar is-sm" aria-hidden>
                            {initials(m.name)}
                          </span>
                          {m.name}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
              {detail.externalMembershipBlocker ? (
                <p className="cosmos-messages-hint">
                  External client/vendor membership is unavailable.{" "}
                  {detail.externalMembershipBlocker}
                </p>
              ) : null}
              <p className="cosmos-messages-hint">
                Pins, reactions, attachments, presence, and delivery status are not part of this
                foundation.
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      {newChannelOpen ? (
        <div className="cosmos-messages-drawer-scrim" role="presentation">
          <aside className="cosmos-messages-drawer" role="dialog" aria-label="New Channel">
            <div className="cosmos-messages-drawer__head">
              <div>
                <p className="cosmos-messages-page__eyebrow">Messages</p>
                <h2>New Channel</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setNewChannelOpen(false)}>
                <XIcon />
              </button>
            </div>
            <label className="cosmos-messages-field">
              <span>Name</span>
              <Input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="vendor-prism"
              />
              <small>Lowercase, no spaces</small>
            </label>
            <label className="cosmos-messages-field">
              <span>Project</span>
              <select
                value={channelProjectId}
                onChange={(e) => setChannelProjectId(e.target.value)}
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.projectId} value={p.projectId}>
                    {p.projectName}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="cosmos-messages-field">
              <legend>Audience</legend>
              {(
                [
                  ["INTERNAL", "Internal team", "Agency members only"],
                  ["CLIENT", "Client-facing", "Internal members; portal clients unavailable"],
                  ["VENDOR", "Vendor-specific", "Internal members; portal vendors unavailable"],
                  ["ANNOUNCEMENTS", "Announcements", "Members read-only except owners"],
                ] as const
              ).map(([value, label, hint]) => (
                <label key={value} className="cosmos-messages-radio">
                  <input
                    type="radio"
                    name="audience"
                    checked={channelAudience === value}
                    onChange={() => setChannelAudience(value)}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="cosmos-messages-field">
              <span>Members</span>
              <div className="cosmos-messages-member-picks">
                {teamMembers.map((m) => (
                    <button
                      key={m.memberId}
                      type="button"
                      className={cn(
                        "cosmos-messages-chip",
                        channelMemberIds.includes(m.memberId) && "is-on",
                      )}
                      onClick={() => toggleChannelMember(m.memberId)}
                    >
                      {m.name}
                    </button>
                  ))}
              </div>
              <small>
                You are always included. External portal people cannot be added yet.
              </small>
            </div>
            <p className="cosmos-messages-hint">
              Audience can be narrowed later but never widened without re-confirming who will see
              past messages. Widening is not implemented in this foundation.
            </p>
            <div className="cosmos-messages-drawer__footer">
              <Button type="button" variant="ghost" onClick={() => setNewChannelOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={creatingChannel}
                onClick={() => void submitNewChannel()}
              >
                Create Channel
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      {taskOpen && taskSource ? (
        <div className="cosmos-messages-drawer-scrim" role="presentation">
          <div className="cosmos-messages-modal" role="dialog" aria-label="Create Task From Message">
            <div className="cosmos-messages-drawer__head">
              <h2>Create Task From Message</h2>
              <button type="button" aria-label="Close" onClick={() => setTaskOpen(false)}>
                <XIcon />
              </button>
            </div>
            <div className="cosmos-messages-task-source">
              <span className="cosmos-messages-avatar is-sm" aria-hidden>
                {initials(taskSource.author?.name || "?")}
              </span>
              <div>
                <small>
                  From {taskSource.author?.name || "Unknown"}
                  {detail ? ` · ${detail.displayName}` : ""}
                </small>
                <p>{taskSource.body}</p>
              </div>
            </div>
            <label className="cosmos-messages-field">
              <span>Task</span>
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            </label>
            <div className="cosmos-messages-fields-row">
              <label className="cosmos-messages-field">
                <span>Assignee</span>
                <select
                  value={taskAssigneeId}
                  onChange={(e) => setTaskAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cosmos-messages-field">
                <span>Due</span>
                <Input
                  type="date"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                />
              </label>
            </div>
            <div className="cosmos-messages-fields-row">
              <label className="cosmos-messages-field">
                <span>Project</span>
                <select
                  value={taskProjectId}
                  onChange={(e) => setTaskProjectId(e.target.value)}
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.projectId} value={p.projectId}>
                      {p.projectName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cosmos-messages-field">
                <span>Visible To</span>
                <Input value="Internal team only" disabled />
                <small>
                  Follows existing project permissions. No separate Task visibility field yet.
                </small>
              </label>
            </div>
            <p className="cosmos-messages-hint">
              The task keeps a link to the original message, and the message shows the task.
            </p>
            <div className="cosmos-messages-drawer__footer">
              <Button type="button" variant="ghost" onClick={() => setTaskOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={creatingTask} onClick={() => void submitTask()}>
                Create Task
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
