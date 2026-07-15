const ACCESS_TOKEN_KEY = "cosmos.accessToken"
const REFRESH_TOKEN_KEY = "cosmos.refreshToken"
const USER_KEY = "cosmos.user"

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setSession(tokens: {
  accessToken: string
  refreshToken: string
  user: unknown
}) {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  localStorage.setItem(USER_KEY, JSON.stringify(tokens.user))
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser<T>() {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

type RequestOptions = RequestInit & {
  auth?: boolean
  apiKey?: boolean
}

function baseUrl() {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? ""
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, apiKey = false, headers, ...rest } = options
  const requestHeaders = new Headers(headers)

  if (!requestHeaders.has("Content-Type") && rest.body) {
    requestHeaders.set("Content-Type", "application/json")
  }

  if (auth) {
    const token = getAccessToken()
    if (token) requestHeaders.set("Authorization", `Bearer ${token}`)
  }

  if (apiKey) {
    const key = import.meta.env.VITE_COSMOS_API_KEY as string | undefined
    if (key) requestHeaders.set("x-cosmos-api-key", key)
  }

  const response = await fetch(`${baseUrl()}${path}`, {
    ...rest,
    headers: requestHeaders,
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    let message =
      (payload as { error?: string; message?: string }).error ||
      (payload as { message?: string }).message ||
      `Request failed (${response.status})`
    if (response.status === 429) {
      message =
        (typeof message === "string" && message.includes("Too many")
          ? message
          : "Rate limited (429). Middleware caps requests per IP — restart middleware after raising the limit, or wait for the window to reset.")
    }
    throw new ApiError(message, response.status)
  }

  return payload as T
}
