import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import ConcertsPage from '@/pages/ConcertsPage'
import ConcertDetailPage from '@/pages/ConcertDetailPage'
import QueuePage from '@/pages/QueuePage'
import ReservationPage from '@/pages/ReservationPage'
import ReservationsPage from '@/pages/ReservationsPage'
import LoginPage from '@/pages/LoginPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ConcertsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/concerts/:concertId"
        element={
          <ProtectedRoute>
            <ConcertDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/queue/:concertId"
        element={
          <ProtectedRoute>
            <QueuePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservation/:concertId"
        element={
          <ProtectedRoute>
            <ReservationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservations"
        element={
          <ProtectedRoute>
            <ReservationsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
