import { create } from 'zustand'
import { api, setAuthToken } from '@/lib/api'
import type { AuthUser } from '@/types'

const TOKEN_KEY = 'synapse:token'
const USER_KEY = 'synapse:user'

function readUser(): AuthUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

// restore token into the api layer as soon as this module loads
const savedToken = localStorage.getItem(TOKEN_KEY)
if (savedToken) setAuthToken(savedToken)

interface AuthState {
  token: string | null
  user: AuthUser | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string) => Promise<boolean>
  logout: () => void
  hydrate: () => Promise<void>
}

function persist(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  setAuthToken(token)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: savedToken,
  user: readUser(),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const res = await api.login(email, password)
      persist(res.access_token, res.user)
      set({ token: res.access_token, user: res.user, loading: false })
      return true
    } catch (e: any) {
      set({ loading: false, error: e?.response?.data?.detail || 'Login failed' })
      return false
    }
  },

  register: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const res = await api.register(email, password)
      persist(res.access_token, res.user)
      set({ token: res.access_token, user: res.user, loading: false })
      return true
    } catch (e: any) {
      set({ loading: false, error: e?.response?.data?.detail || 'Registration failed' })
      return false
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setAuthToken(null)
    set({ token: null, user: null, error: null })
  },

  // revalidate a restored token on app start
  hydrate: async () => {
    if (!get().token) return
    try {
      const user = await api.me()
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      set({ user })
    } catch {
      get().logout()
    }
  },
}))
