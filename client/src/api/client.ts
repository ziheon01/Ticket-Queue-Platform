const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export function getToken(): string | null {
  return localStorage.getItem('vibe_token')
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  const body: { success: boolean; data: T; message?: string } = await res
    .json()
    .catch(() => ({ success: false, data: null, message: '응답 파싱 실패' }))

  if (!res.ok) {
    throw new ApiError(res.status, body.message ?? `HTTP ${res.status}`)
  }

  return body.data
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string) => request<T>(path, { method: 'POST' }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  socketUrl: BASE,
}
