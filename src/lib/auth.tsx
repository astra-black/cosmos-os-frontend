import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { login as loginRequest } from "@/lib/api/agency"
import {
  ApiError,
  clearSession,
  getAccessToken,
  getStoredUser,
  setSession,
} from "@/lib/api/client"
import type { AuthUser } from "@/types/agency"

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (updates: Partial<AuthUser>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser<AuthUser>())
  const [token, setToken] = useState<string | null>(() => getAccessToken())
  const [hydrated, setHydrated] = useState(true)

  useEffect(() => {
    const storedToken = getAccessToken()
    const storedUser = getStoredUser<AuthUser>()
    if (storedToken !== token) setToken(storedToken)
    if (storedUser && JSON.stringify(storedUser) !== JSON.stringify(user)) {
      setUser(storedUser)
    }
  }, [token, user])

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password)
    if (!response.success || !response.data?.accessToken) {
      throw new ApiError(response.error || "Login failed", 401)
    }
    const loggedInUser = response.data.user
    if (loggedInUser?.id) {
      const isLocallyCompleted = localStorage.getItem(`cosmos.onboarding_completed_${loggedInUser.id}`) === "true"
      if (isLocallyCompleted && !loggedInUser.onboardingCompletedAt) {
        loggedInUser.onboardingCompletedAt = new Date().toISOString()
      }
    }
    setSession({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      user: loggedInUser,
    })
    setUser(loggedInUser)
    setToken(response.data.accessToken)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setToken(null)
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      logout()
      if (typeof window === "undefined") return

      const path = window.location.pathname
      const isPublicDesk =
        path.includes("/checkin") ||
        path.includes("/crew-kiosk") ||
        path.includes("/stage") ||
        path.includes("/display") ||
        path.startsWith("/invite") ||
        path.startsWith("/join") ||
        path === "/" ||
        path === "/landing" ||
        path === "/login"

      if (isPublicDesk) {
        return
      }

      const isPortal = path.startsWith("/portal")
      window.location.href = isPortal ? "/portal/login" : "/login"
    }
    window.addEventListener("cosmos-unauthorized", handleUnauthorized)
    return () => {
      window.removeEventListener("cosmos-unauthorized", handleUnauthorized)
    }
  }, [logout])

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((current) => {
      if (!current) return current
      const next = { ...current, ...updates }
      localStorage.setItem("cosmos.user", JSON.stringify(next))
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: hydrated && Boolean(token),
      login,
      logout,
      updateUser,
    }),
    [user, token, hydrated, login, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
