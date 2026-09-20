import { useEffect, useRef, useState, useCallback } from "react"
import { getAccessToken } from "@/lib/api/client"

export type LiveOpsEvent =
  | { type: "CUE_STARTED"; data: { cue: any; assignedCrew?: any } }
  | { type: "CUE_ADVANCED"; data: { completed?: any; started?: any; cues?: any[] } }
  | { type: "CUE_COMPLETED"; data: { cue: any } }
  | { type: "CUE_SKIPPED"; data: { cue: any } }
  | { type: "CUE_RESET"; data: { cue: any } }
  | { type: "CUE_UPDATED"; data: { cue: any } }
  | { type: "CUE_CREATED"; data: { cue: any } }
  | { type: "CUE_DELETED"; data: { cueId: string } }
  | { type: "CUE_ASSIGNED"; data: { cue: any; assignedCrew?: any } }
  | { type: "INCIDENT_FLAGGED"; data: { incident: any } }
  | { type: "INCIDENT_ESCALATED"; data: { incident: any } }
  | { type: "INCIDENT_LOGGED"; data: { incident: any } }
  | { type: "INCIDENT_UPDATED"; data: { incident: any } }
  | { type: "INCIDENT_RESOLVED"; data: { incident: any } }
  | { type: "INCIDENT_DELETED"; data: { incidentId: string } }
  | { type: string; data?: any }

export type UseLiveOpsWsOptions = {
  eventId?: string
  onEvent?: (event: LiveOpsEvent) => void
  enabled?: boolean
}

export function useLiveOpsWs({ eventId, onEvent, enabled = true }: UseLiveOpsWsOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const connect = useCallback(() => {
    if (!enabled || typeof window === "undefined") return

    const token = getAccessToken()
    if (!token) {
      setIsConnected(false)
      return
    }

    // Determine WS protocol based on current window location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    // In dev / Vite proxy, connect to current host or API host
    const host = window.location.host
    const query = new URLSearchParams({ token })
    if (eventId) query.set("eventId", eventId)

    const wsUrl = `${protocol}//${host}/api/v1/liveops/ws?${query.toString()}`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        if (eventId) {
          ws.send(JSON.stringify({ type: "JOIN_EVENT", eventId }))
        }
      }

      ws.onmessage = (event) => {
        setLastMessageTime(new Date())
        try {
          const payload = JSON.parse(event.data)
          if (payload.type === "PING") {
            ws.send(JSON.stringify({ type: "PONG" }))
            return
          }
          if (onEventRef.current) {
            onEventRef.current(payload)
          }
        } catch (_) {
          // Ignore non-JSON or ping frames
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        if (enabled) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000)
        }
      }

      ws.onerror = () => {
        setIsConnected(false)
        try {
          ws.close()
        } catch (_) {}
      }
    } catch (_) {
      setIsConnected(false)
      if (enabled) {
        reconnectTimeoutRef.current = setTimeout(connect, 4000)
      }
    }
  }, [enabled, eventId])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        try {
          wsRef.current.close()
        } catch (_) {}
        wsRef.current = null
      }
    }
  }, [connect])

  const sendEvent = useCallback((type: string, data: Record<string, any> = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, eventId, ...data }))
      return true
    }
    return false
  }, [eventId])

  return {
    isConnected,
    lastMessageTime,
    sendEvent,
  }
}
