import {
  createContext,
  useCallback,
  useContext,
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

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password)
    if (!response.success || !response.data?.accessToken) {
      throw new ApiError(response.error || "Login failed", 401)
    }
    setSession({
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      user: response.data.user,
    })
    setUser(response.data.user)
    setToken(response.data.accessToken)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setToken(null)
  }, [])

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
      isAuthenticated: Boolean(token),
      login,
      logout,
      updateUser,
    }),
    [user, token, login, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
