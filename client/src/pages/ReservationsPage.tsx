import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { api } from '@/api/client'
import { Navbar } from '@/components/Navbar'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED'

interface Reservation {
  id: string
  status: ReservationStatus
  quantity: number
  totalPrice: number
  createdAt: string
  concertZone: {
    id: string
    name: string
    price: number
    concert: {
      id: string
      title: string
      artist: string
      venue: string
      concertDate: string
    }
  }
  payment: {
    id: string
    status: string
    amount: number
    paidAt: string | null
  } | null
}

// ---------------------------------------------------------------------------
// useReservations hook
// ---------------------------------------------------------------------------

function useReservations() {
  const [data, setData] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await api.get<Reservation[]>('/api/reservations')
      setData(list)
    } catch {
      setError('예매 내역을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, retry: fetch }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('material-symbols-outlined select-none', className)}>
      {name}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
}

function formatCreatedAt(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\. /g, '.').replace('.', '')
}

function formatPrice(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<ReservationStatus, { label: string; className: string }> = {
  PENDING: {
    label: '결제 대기',
    className: 'bg-[#2A2210] text-[#fbbf24] border border-[#92400e]',
  },
  CONFIRMED: {
    label: '예매 완료',
    className: 'bg-[#14532d] text-[#4ade80] border border-[#166534]',
  },
  CANCELLED: {
    label: '취소됨',
    className: 'bg-[#1c1f30] text-[#958da1] border border-[#4a4455]',
  },
  EXPIRED: {
    label: '기간 만료',
    className: 'bg-[#1c0a0a] text-[#f87171] border border-[#991b1b]/50',
  },
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold font-mono tracking-wide whitespace-nowrap',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Cancel confirm dialog
// ---------------------------------------------------------------------------

function CancelDialog({
  reservationTitle,
  onConfirm,
  onCancel,
  isLoading,
}: {
  reservationTitle: string
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* dialog */}
      <div className="relative z-10 w-full max-w-sm bg-[#1c1f30] border border-[#2D3155] rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-900/40 border border-red-800/50 flex items-center justify-center flex-shrink-0">
            <Icon name="warning" className="text-[20px] text-red-400" />
          </div>
          <div>
            <h3 className="font-display font-bold text-white text-base">예매 취소</h3>
            <p className="text-xs text-[#958da1] mt-0.5">취소 후 되돌릴 수 없습니다</p>
          </div>
        </div>

        <p className="text-sm text-[#ccc3d8] mb-6 leading-relaxed">
          <span className="text-white font-semibold">{reservationTitle}</span> 예매를
          취소하시겠습니까?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className={cn(
              'flex-1 h-10 rounded-xl text-sm font-semibold border transition-all duration-200',
              'border-[#4a4455] text-[#ccc3d8] hover:border-[#7c3aed] hover:text-[#d2bbff]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            돌아가기
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'flex-1 h-10 rounded-xl text-sm font-semibold transition-all duration-200',
              'bg-red-700 hover:bg-red-600 text-white',
              'hover:shadow-[0_0_12px_rgba(239,68,68,0.4)] active:scale-95',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                취소 중…
              </span>
            ) : (
              '예매 취소'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reservation card
// ---------------------------------------------------------------------------

function ReservationCard({
  reservation,
  dark,
  onCancel,
}: {
  reservation: Reservation
  dark: boolean
  onCancel: (id: string) => void
}) {
  const { concertZone, payment } = reservation
  const { concert } = concertZone
  const isExpired = reservation.status === 'EXPIRED' || reservation.status === 'CANCELLED'
  const amount = payment?.amount ?? reservation.totalPrice

  return (
    <div
      className={cn(
        'rounded-2xl border p-6 transition-all duration-300',
        dark
          ? 'bg-[#1A1D2E] border-[#2D3155] hover:border-[#7c3aed]/40'
          : 'bg-white border-[#DDD8F0] shadow-sm hover:border-[#7c3aed]/40',
        isExpired && 'opacity-60',
      )}
    >
      {/* Top row: title + badge */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h3
            className={cn(
              'font-display font-bold text-[17px] leading-snug truncate',
              dark ? 'text-white' : 'text-[#1A1D2E]',
            )}
          >
            {concert.title}
          </h3>
          <p className={cn('text-sm font-medium mt-0.5', dark ? 'text-[#adc6ff]' : 'text-[#3b82f6]')}>
            {concert.artist}
          </p>
        </div>
        <StatusBadge status={reservation.status} />
      </div>

      {/* Divider */}
      <div className={cn('border-t mb-4', dark ? 'border-[#2D3155]' : 'border-[#EDE9FE]')} />

      {/* Info grid */}
      <div className={cn('flex flex-col gap-2.5 mb-5 text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
        <div className="flex items-center gap-2.5">
          <Icon name="calendar_month" className="text-[16px] opacity-60 flex-shrink-0" />
          <span>{formatDate(concert.concertDate)}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Icon name="location_on" className="text-[16px] opacity-60 flex-shrink-0" />
          <span>{concert.venue}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Icon name="confirmation_number" className="text-[16px] flex-shrink-0 text-[#d2bbff]" />
          <span>
            <span className={cn('font-semibold', dark ? 'text-[#d2bbff]' : 'text-[#7c3aed]')}>
              {concertZone.name}
            </span>
            <span className="mx-1.5 opacity-40">·</span>
            {reservation.quantity}매
          </span>
        </div>
      </div>

      {/* Bottom row: date + price + cancel */}
      <div className={cn('flex items-center justify-between gap-4 pt-4 border-t', dark ? 'border-[#2D3155]' : 'border-[#EDE9FE]')}>
        <span className={cn('font-mono text-xs opacity-60', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
          예매일: {formatCreatedAt(reservation.createdAt)}
        </span>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span
            className={cn(
              'font-display font-bold text-lg',
              isExpired ? 'opacity-50' : dark ? 'text-white' : 'text-[#1A1D2E]',
            )}
          >
            {formatPrice(amount)}
          </span>

          {reservation.status === 'PENDING' && (
            <button
              onClick={() => onCancel(reservation.id)}
              className={cn(
                'px-3.5 h-8 rounded-lg text-xs font-semibold border transition-all duration-200',
                'border-[#ef4444]/50 text-[#ef4444]',
                'hover:bg-red-950/50 hover:border-[#ef4444] active:scale-95',
              )}
            >
              예매 취소
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard({ dark }: { dark: boolean }) {
  const shimmer = dark ? 'bg-white/8 animate-pulse' : 'bg-gray-200 animate-pulse'
  return (
    <div
      className={cn(
        'rounded-2xl border p-6',
        dark ? 'bg-[#1A1D2E] border-[#2D3155]' : 'bg-white border-[#DDD8F0]',
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 flex flex-col gap-2">
          <div className={cn('h-5 w-3/4 rounded', shimmer)} />
          <div className={cn('h-3.5 w-1/3 rounded', shimmer)} />
        </div>
        <div className={cn('h-6 w-20 rounded-full flex-shrink-0', shimmer)} />
      </div>
      <div className={cn('h-px mb-4', dark ? 'bg-[#2D3155]' : 'bg-[#EDE9FE]')} />
      <div className="flex flex-col gap-2.5 mb-5">
        <div className={cn('h-4 w-1/2 rounded', shimmer)} />
        <div className={cn('h-4 w-2/5 rounded', shimmer)} />
        <div className={cn('h-4 w-1/3 rounded', shimmer)} />
      </div>
      <div className={cn('h-px mb-4', dark ? 'bg-[#2D3155]' : 'bg-[#EDE9FE]')} />
      <div className="flex justify-between items-center">
        <div className={cn('h-3 w-24 rounded', shimmer)} />
        <div className={cn('h-6 w-28 rounded', shimmer)} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ dark, onGoConcerts }: { dark: boolean; onGoConcerts: () => void }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-24 gap-5 rounded-2xl border',
        dark ? 'bg-[#1A1D2E] border-[#2D3155] text-[#ccc3d8]' : 'bg-white border-[#DDD8F0] text-[#64748b]',
      )}
    >
      <div
        className={cn(
          'w-20 h-20 rounded-full flex items-center justify-center',
          dark ? 'bg-[#313446]' : 'bg-[#F5F3FF]',
        )}
      >
        <Icon name="confirmation_number" className="text-[40px] opacity-40" />
      </div>
      <div className="text-center">
        <p className={cn('font-display font-bold text-lg mb-1', dark ? 'text-white' : 'text-[#1A1D2E]')}>
          아직 예매한 티켓이 없습니다
        </p>
        <p className="text-sm opacity-70">관심 있는 공연을 찾아 대기열에 진입해보세요</p>
      </div>
      <button
        onClick={onGoConcerts}
        className={cn(
          'mt-1 px-6 h-10 rounded-xl text-sm font-semibold text-white transition-all duration-200',
          'bg-[#7c3aed] hover:bg-[#6d28d9] hover:shadow-[0_0_15px_rgba(124,58,237,0.5)] active:scale-95',
        )}
      >
        공연 보러가기
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ dark, onRetry }: { dark: boolean; onRetry: () => void }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-24 gap-5 rounded-2xl border',
        dark ? 'bg-[#1A1D2E] border-[#2D3155] text-[#ccc3d8]' : 'bg-white border-[#DDD8F0] text-[#64748b]',
      )}
    >
      <Icon name="error_outline" className="text-[56px] text-red-400 opacity-80" />
      <div className="text-center">
        <p className={cn('font-display font-bold text-lg mb-1', dark ? 'text-white' : 'text-[#1A1D2E]')}>
          예매 내역을 불러오지 못했습니다
        </p>
        <p className="text-sm opacity-70 mb-5">잠시 후 다시 시도해주세요</p>
        <button
          onClick={onRetry}
          className="px-6 h-10 rounded-xl text-sm font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] hover:shadow-[0_0_15px_rgba(124,58,237,0.4)] active:scale-95 transition-all duration-200"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer({ dark }: { dark: boolean }) {
  return (
    <footer
      className={cn(
        'mt-16 border-t pb-8 font-mono text-xs',
        dark ? 'bg-[#0a0d1d] border-[#313446]' : 'bg-[#EDE9FE] border-[#DDD8F0]',
      )}
    >
      <div className="max-w-[1200px] mx-auto py-10 px-5 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <span className="font-display font-bold text-[20px] text-[#7c3aed]">VIBE TICKETS</span>
          <span className={cn('opacity-70', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
            © 2026 VIBE TICKETS. All rights reserved.
          </span>
        </div>
        <div className="flex gap-6">
          {['이용약관', '개인정보처리방침', '취소 및 환불 규정', '사업자정보'].map((link) => (
            <a
              key={link}
              href="#"
              className={cn(
                'opacity-70 hover:opacity-100 transition-opacity',
                dark ? 'text-[#ccc3d8] hover:text-[#7c3aed]' : 'text-[#64748b] hover:text-[#7c3aed]',
              )}
            >
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReservationsPage() {
  const navigate = useNavigate()
  const [dark, setDark] = useState(true)
  const [nickname, setNickname] = useState<string | undefined>(undefined)

  // cancel dialog state
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const { data: reservations, loading, error, retry } = useReservations()

  useEffect(() => {
    api
      .get<{ nickname: string }>('/api/auth/me')
      .then((user) => setNickname(user.nickname))
      .catch(() => {})
  }, [])

  const handleCancelClick = useCallback((id: string) => {
    const target = reservations.find((r) => r.id === id) ?? null
    setCancelTarget(target)
    setCancelError(null)
  }, [reservations])

  const handleCancelConfirm = useCallback(async () => {
    if (!cancelTarget) return
    setCancelLoading(true)
    setCancelError(null)
    try {
      await api.delete(`/api/reservations/${cancelTarget.id}`)
      setCancelTarget(null)
      retry()
    } catch {
      setCancelError('취소 처리 중 오류가 발생했습니다')
    } finally {
      setCancelLoading(false)
    }
  }, [cancelTarget, retry])

  return (
    <div className={dark ? 'dark' : ''}>
      <div
        className={cn(
          'min-h-screen flex flex-col',
          dark
            ? 'bg-gradient-to-br from-[#0D0F1A] to-[#12142A] text-[#dfe1f9]'
            : 'bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] text-[#1A1D2E]',
        )}
      >
        <Navbar dark={dark} onToggle={() => setDark((d) => !d)} nickname={nickname} />

        <main className="flex-grow pt-24 pb-16 px-5">
          <div className="max-w-[800px] mx-auto">
            {/* Breadcrumb */}
            <p className={cn('text-xs mb-4 font-mono opacity-60', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
              홈 &gt; 마이페이지 &gt; 예매 내역
            </p>

            {/* Page header */}
            <div className="mb-8">
              <h1
                className={cn(
                  'font-display font-bold text-[28px] leading-tight mb-1.5',
                  dark ? 'text-white' : 'text-[#1A1D2E]',
                )}
              >
                내 예매 내역
              </h1>
              {!loading && !error && (
                <p className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
                  총 {reservations.length}건의 예매 내역이 있습니다
                </p>
              )}
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex flex-col gap-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} dark={dark} />
                ))}
              </div>
            ) : error ? (
              <ErrorState dark={dark} onRetry={retry} />
            ) : reservations.length === 0 ? (
              <EmptyState dark={dark} onGoConcerts={() => navigate('/')} />
            ) : (
              <div className="flex flex-col gap-5">
                {reservations.map((r) => (
                  <ReservationCard
                    key={r.id}
                    reservation={r}
                    dark={dark}
                    onCancel={handleCancelClick}
                  />
                ))}
              </div>
            )}

            {/* Cancel error inline toast */}
            {cancelError && !cancelTarget && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-red-900/30 border border-red-800/50 text-red-400 text-sm flex items-center gap-2">
                <Icon name="error" className="text-[18px]" />
                {cancelError}
              </div>
            )}
          </div>
        </main>

        <Footer dark={dark} />
      </div>

      {/* Cancel confirm dialog */}
      {cancelTarget && (
        <CancelDialog
          reservationTitle={cancelTarget.concertZone.concert.title}
          onConfirm={handleCancelConfirm}
          onCancel={() => { setCancelTarget(null); setCancelError(null) }}
          isLoading={cancelLoading}
        />
      )}
    </div>
  )
}
