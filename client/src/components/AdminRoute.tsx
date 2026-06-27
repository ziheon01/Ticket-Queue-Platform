import { Navigate } from 'react-router-dom'
import { getToken, getRole } from '@/api/client'

export function AdminRoute({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />
  if (getRole() !== 'ADMIN') return <Navigate to="/" replace />
  return <>{children}</>
}
