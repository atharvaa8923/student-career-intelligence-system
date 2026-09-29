import { create } from 'zustand'

interface User { id: string; email: string; full_name: string; role: string }

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  setAuth: (user: User, token: string, refreshToken?: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  token: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('access_token', token)
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
    set({ user, token, refreshToken: refreshToken || localStorage.getItem('refresh_token') })
  },
  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, token: null, refreshToken: null })
  }
}))
