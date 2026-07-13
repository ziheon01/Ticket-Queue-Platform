import axios from 'axios'

export function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const serverMsg: string | undefined = err.response?.data?.message
    return serverMsg ?? fallback
  }
  if (err instanceof Error) return err.message
  return fallback
}
