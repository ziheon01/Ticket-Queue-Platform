import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import QueuePage from '@/pages/QueuePage'
import LoginPage from '@/pages/LoginPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<QueuePage />} />
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
