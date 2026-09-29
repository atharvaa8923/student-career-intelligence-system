// frontend/src/lib/api.ts
import axios from 'axios'
import { useAuthStore } from '../store/authStore'

// In production (Vercel), set VITE_API_URL to your Railway backend URL,
// e.g. https://syllacheck-api.up.railway.app
// In local dev, the Vite proxy forwards /api → http://localhost:8000
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({ baseURL: BASE_URL })

// Attach JWT on every request
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise: Promise<any> | null = null

// Refresh once and replay requests that encounter an expired access token.
api.interceptors.response.use(
  r => r,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original?._retried && !original?.url?.includes('/auth/refresh')) {
      const refreshToken = useAuthStore.getState().refreshToken
      if (refreshToken) {
        original._retried = true
        refreshPromise ||= axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken }).finally(() => { refreshPromise = null })
        try {
          const refreshed = await refreshPromise
          const state = useAuthStore.getState()
          if (state.user) state.setAuth(state.user, refreshed.data.access_token, refreshed.data.refresh_token)
          original.headers.Authorization = `Bearer ${refreshed.data.access_token}`
          return api(original)
        } catch { /* fall through to local sign-out */ }
      }
      useAuthStore.getState().logout()
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

export default api
