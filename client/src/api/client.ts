import axios, { type InternalAxiosRequestConfig } from 'axios'

// ---------------------------------------------------------------------------
// 백엔드 공통 응답 래퍼
// ---------------------------------------------------------------------------

export interface ApiResponse<T = null> {
  success: boolean
  data: T
  message?: string
}

// ---------------------------------------------------------------------------
// localStorage 키
// ---------------------------------------------------------------------------

export const ACCESS_TOKEN_KEY = 'accessToken'
export const REFRESH_TOKEN_KEY = 'refreshToken'

// ---------------------------------------------------------------------------
// axios 인스턴스
// ---------------------------------------------------------------------------

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

const client = axios.create({ baseURL: BASE })

// ---------------------------------------------------------------------------
// Request 인터셉터: accessToken 자동 부착
// ---------------------------------------------------------------------------

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ---------------------------------------------------------------------------
// Response 인터셉터: 401 → refreshToken으로 재발급 → 원요청 재시도
// ---------------------------------------------------------------------------

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let isRefreshing = false
let waitQueue: Array<(token: string) => void> = []

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config as RetryableConfig

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }
    original._retry = true

    // 이미 재발급 중이면 완료될 때까지 대기
    if (isRefreshing) {
      return new Promise((resolve) => {
        waitQueue.push((token) => {
          original.headers.Authorization = `Bearer ${token}`
          resolve(client(original))
        })
      })
    }

    isRefreshing = true
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
      if (!refreshToken) throw new Error('no refresh token')

      const { data } = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
        `${BASE}/api/auth/refresh`,
        { refreshToken },
      )

      const { accessToken, refreshToken: newRefresh } = data.data
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
      localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh)

      waitQueue.forEach((cb) => cb(accessToken))
      waitQueue = []

      original.headers.Authorization = `Bearer ${accessToken}`
      return client(original)
    } catch {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      window.location.href = '/login'
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  },
)

// ---------------------------------------------------------------------------
// 헬퍼: data.data 자동 추출 + socketUrl 노출
// ---------------------------------------------------------------------------

export const api = {
  get: <T>(path: string) =>
    client.get<ApiResponse<T>>(path).then((r) => r.data.data),
  post: <T>(path: string, body?: unknown) =>
    client.post<ApiResponse<T>>(path, body).then((r) => r.data.data),
  patch: <T>(path: string, body?: unknown) =>
    client.patch<ApiResponse<T>>(path, body).then((r) => r.data.data),
  delete: <T>(path: string) =>
    client.delete<ApiResponse<T>>(path).then((r) => r.data.data),
  socketUrl: BASE,
}

export function getToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRole(): 'ADMIN' | 'USER' | null {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  if (!token) return null
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64)) as { role?: string }
    if (payload.role === 'ADMIN' || payload.role === 'USER') return payload.role
    return null
  } catch {
    return null
  }
}

export default client
