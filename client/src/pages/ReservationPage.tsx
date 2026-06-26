import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/api/client'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import axios from 'axios'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConcertZone {
  id: string
  name: string
  price: number
  totalQuantity: number
  remainQuantity: number
}

interface Concert {
  id: string
  title: string
  artist: string
  venue: string
  concertDate: string
  status: string
  zones: ConcertZone[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------

function Icon({ name, className }: { name: string; className?: string }) {
  return <span className={cn('material-symbols-outlined', className)}>{name}</span>
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function Navbar({
  dark,
  onToggle,
  nickname,
}: {
  dark: boolean
  onToggle: () => void
  nickname?: string
}) {
  const navigate = useNavigate()
  const handleLogout = async () => {
    try { await api.post('/api/auth/logout', { refreshToken: localStorage.getItem('refreshToken') }) } catch {}
    localStorage.clear()
    navigate('/login', { replace: true })
  }
  return (
    <nav
      className={cn(
        'fixed top-0 w-full z-50 border-b shadow-sm backdrop-blur-md',
        dark ? 'bg-[#0f1223]/80 border-[#313446]' : 'bg-white/85 border-[#DDD8F0]',
      )}
    >
      <div className="flex justify-between items-center h-16 px-5 max-w-[1200px] mx-auto">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <Icon name="confirmation_number" className="text-[#7c3aed] text-2xl" />
          <span className="font-display font-bold text-[20px] tracking-tighter text-[#7c3aed]">
            VIBE TICKETS
          </span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm">
          {[
            { label: '공연', active: false, href: '/' },
            { label: '티켓팅', active: true, href: '/' },
            { label: '마이페이지', active: false, href: '/reservations' },
            { label: '고객센터', active: false, href: '#' },
          ].map(({ label, active, href }) => (
            <button
              key={label}
              onClick={() => (href !== '#' ? navigate(href) : undefined)}
              className={cn(
                'transition-colors duration-200',
                active
                  ? 'text-[#7c3aed] font-bold border-b-2 border-[#7c3aed] pb-1'
                  : dark
                    ? 'text-[#ccc3d8] hover:text-[#7c3aed]'
                    : 'text-[#64748b] hover:text-[#7c3aed]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onToggle}
            aria-label="테마 전환"
            className={cn(
              'p-2 rounded-lg transition-all active:scale-95',
              dark
                ? 'text-[#d2bbff] hover:bg-white/10'
                : 'text-[#7c3aed] hover:bg-[#7c3aed]/5',
            )}
          >
            <Icon name={dark ? 'dark_mode' : 'light_mode'} className="text-[22px]" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg transition-all active:scale-95',
                  dark ? 'text-[#d2bbff] hover:bg-white/10' : 'text-[#7c3aed] hover:bg-[#7c3aed]/5',
                )}
              >
                <Icon name="account_circle" className="text-[22px]" />
                {nickname ? (
                  <span className="text-sm font-medium">{nickname}</span>
                ) : (
                  <span className={cn('text-sm font-medium w-12 h-3.5 rounded animate-pulse', dark ? 'bg-white/10' : 'bg-[#7c3aed]/10')} />
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn('w-44', dark ? 'bg-[#1c1f30] border-[#2D3155] text-[#dfe1f9]' : 'bg-white border-[#DDD8F0] text-[#1A1D2E]')}
            >
              <DropdownMenuItem
                className={cn('cursor-pointer gap-2 text-sm', dark ? 'focus:bg-[#26293b] focus:text-white' : 'focus:bg-[#F5F3FF] focus:text-[#1A1D2E]')}
                onClick={() => navigate('/reservations')}
              >
                <Icon name="confirmation_number" className="text-[15px]" />
                예매 내역
              </DropdownMenuItem>
              <DropdownMenuSeparator className={dark ? 'bg-[#2D3155]' : 'bg-[#DDD8F0]'} />
              <DropdownMenuItem
                className={cn('cursor-pointer gap-2 text-sm', dark ? 'text-[#f87171] focus:bg-red-950/50 focus:text-red-400' : 'text-red-500 focus:bg-red-50 focus:text-red-600')}
                onClick={handleLogout}
              >
                <Icon name="logout" className="text-[15px]" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Timer Banner
// ---------------------------------------------------------------------------

function TimerBanner({
  remainSeconds,
  extended,
  onExtend,
  dark,
}: {
  remainSeconds: number
  extended: boolean
  onExtend: () => void
  dark: boolean
}) {
  const isUrgent = remainSeconds <= 60
  const pct = Math.max(0, (remainSeconds / 300) * 100)

  return (
    <div
      className={cn(
        'sticky top-16 z-40 border-b',
        isUrgent
          ? 'bg-gradient-to-r from-red-700 to-red-600 border-red-800'
          : dark
            ? 'bg-gradient-to-r from-[#1c1f30] to-[#12152a] border-[#313446]'
            : 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] border-[#6d28d9]',
      )}
    >
      <div className="max-w-[1200px] mx-auto px-5 py-3 flex items-center gap-5">
        <div className="flex items-center gap-2 shrink-0">
          <Icon
            name="timer"
            className={cn(
              'text-[22px]',
              isUrgent ? 'text-red-200 animate-pulse' : 'text-white/80',
            )}
          />
          <span className="text-white/70 text-sm font-medium hidden sm:block">결제 제한 시간</span>
        </div>

        <span
          className={cn(
            'font-mono text-3xl font-bold tracking-widest text-white shrink-0',
            isUrgent && 'animate-pulse',
          )}
        >
          {formatTime(remainSeconds)}
        </span>

        <div className="flex-1 mx-2">
          <div className="h-1.5 rounded-full bg-white/20">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                isUrgent ? 'bg-red-300' : 'bg-white/70',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-white/50 text-xs mt-1 hidden sm:block">
            {isUrgent
              ? '⚠️ 1분 이하 남았습니다. 지금 시간을 연장하세요.'
              : '결제를 완료하지 않으면 선점이 자동 취소됩니다.'}
          </p>
        </div>

        <button
          onClick={onExtend}
          disabled={!isUrgent || extended}
          className={cn(
            'shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all border whitespace-nowrap',
            extended
              ? 'border-white/20 text-white/40 cursor-not-allowed'
              : !isUrgent
                ? 'border-white/20 text-white/40 cursor-not-allowed'
                : 'border-white/70 text-white hover:bg-white/20 active:scale-95',
          )}
        >
          <Icon name="update" className="text-[16px]" />
          {extended ? '연장됨' : '시간 연장'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Zone Card
// ---------------------------------------------------------------------------

const ZONE_ACCENTS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b'] as const

function ZoneCard({
  zone,
  selected,
  onSelect,
  dark,
  index,
}: {
  zone: ConcertZone
  selected: boolean
  onSelect: () => void
  dark: boolean
  index: number
}) {
  const soldOut = zone.remainQuantity === 0
  const lowStock = zone.remainQuantity > 0 && zone.remainQuantity <= 10
  const accent = ZONE_ACCENTS[index % ZONE_ACCENTS.length]

  return (
    <button
      type="button"
      onClick={soldOut ? undefined : onSelect}
      disabled={soldOut}
      className={cn(
        'w-full rounded-xl p-5 text-left border-2 transition-all duration-200',
        soldOut
          ? cn(
              'cursor-not-allowed',
              dark
                ? 'bg-[#1A1D2E]/50 border-[#2D3155]/50 opacity-50'
                : 'bg-gray-50 border-gray-200 opacity-50',
            )
          : selected
            ? 'shadow-lg'
            : cn(
                'hover:scale-[1.01] active:scale-[0.99]',
                dark
                  ? 'bg-[#1A1D2E] border-[#2D3155] hover:border-[#4a4455]'
                  : 'bg-white border-[#DDD8F0] hover:border-[#c4b5fd] shadow-sm',
              ),
      )}
      style={
        selected
          ? { borderColor: accent, background: `${accent}1a` }
          : undefined
      }
    >
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: soldOut ? '#6b7280' : accent }}
            />
            <span
              className={cn(
                'font-display font-bold text-lg',
                soldOut
                  ? 'text-[#6b7280]'
                  : dark
                    ? 'text-white'
                    : 'text-[#1A1D2E]',
              )}
            >
              {zone.name}
            </span>
            {lowStock && (
              <span className="text-xs font-bold text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">
                마감임박
              </span>
            )}
            {soldOut && (
              <span className="text-xs font-bold text-[#6b7280] bg-[#6b7280]/20 px-1.5 py-0.5 rounded">
                SOLD OUT
              </span>
            )}
          </div>
          <p className={cn('text-sm pl-4', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
            잔여{' '}
            <strong
              className={
                soldOut
                  ? 'text-[#6b7280]'
                  : lowStock
                    ? 'text-red-400'
                    : dark
                      ? 'text-white'
                      : 'text-[#1A1D2E]'
              }
            >
              {formatNumber(zone.remainQuantity)}
            </strong>
            석 / 총 {formatNumber(zone.totalQuantity)}석
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              'font-display font-bold text-xl',
              soldOut
                ? 'text-[#6b7280]'
                : dark
                  ? 'text-white'
                  : 'text-[#1A1D2E]',
            )}
          >
            {formatNumber(zone.price)}
            <span className="text-sm font-normal ml-0.5">원</span>
          </span>
          {selected && (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: accent }}
            >
              <Icon name="check" className="text-white text-[16px]" />
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function Skeleton({ dark }: { dark: boolean }) {
  return (
    <div className="max-w-[1200px] mx-auto px-5 pt-8">
      <div
        className={cn(
          'h-5 w-48 rounded mb-6 animate-pulse',
          dark ? 'bg-white/10' : 'bg-[#7c3aed]/10',
        )}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                'h-24 rounded-xl animate-pulse',
                dark ? 'bg-white/5' : 'bg-[#7c3aed]/5',
              )}
            />
          ))}
        </div>
        <div
          className={cn(
            'h-72 rounded-xl animate-pulse',
            dark ? 'bg-white/5' : 'bg-[#7c3aed]/5',
          )}
        />
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
          <span className="font-display font-bold text-[20px] text-[#7c3aed]">
            VIBE TICKETS
          </span>
          <span className={cn('opacity-70', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
            © 2024 VIBE TICKETS. All rights reserved.
          </span>
        </div>
        <div className="flex gap-6">
          {['이용약관', '개인정보처리방침', '회사소개', '문의하기'].map((link) => (
            <a
              key={link}
              href="#"
              className={cn(
                'opacity-70 hover:opacity-100 transition-opacity',
                dark
                  ? 'text-[#ccc3d8] hover:text-[#7c3aed]'
                  : 'text-[#64748b] hover:text-[#7c3aed]',
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

export default function ReservationPage() {
  const { concertId } = useParams<{ concertId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [dark, setDark] = useState(() => {
    return document.documentElement.classList.contains('dark')
  })
  const [nickname, setNickname] = useState<string | undefined>()
  const [userId, setUserId] = useState<string | null>(null)
  const [concert, setConcert] = useState<Concert | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [reservationId, setReservationId] = useState<string | null>(null)
  const [remainSeconds, setRemainSeconds] = useState(300)
  const [extended, setExtended] = useState(false)

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [isPaying, setIsPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const selectedZone = concert?.zones.find((z) => z.id === selectedZoneId) ?? null
  const totalPrice = selectedZone ? selectedZone.price * quantity : 0

  // ── 다크 모드 동기화 ──────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  // ── URL 파라미터로 전달된 결제 실패 에러 처리 ───────────────
  useEffect(() => {
    const code = searchParams.get('code')
    const message = searchParams.get('message')
    if (code) {
      setPayError(
        code === 'USER_CANCEL'
          ? '결제를 취소했습니다.'
          : message ?? `결제 실패 (${code})`,
      )
    }
  }, [searchParams])

  // ── 공연 정보 + 사용자 정보 조회 ─────────────────────────────
  useEffect(() => {
    if (!concertId) return
    let cancelled = false

    async function init() {
      try {
        const [concertData, user] = await Promise.all([
          api.get<Concert>(`/api/concerts/${concertId}`),
          api.get<{ id: string; nickname: string }>('/api/auth/me'),
        ])
        if (cancelled) return
        setConcert(concertData)
        setNickname(user.nickname)
        setUserId(user.id)
      } catch (err) {
        if (cancelled) return
        const msg = axios.isAxiosError(err)
          ? (err.response?.data?.message ?? err.message)
          : '공연 정보를 불러올 수 없습니다'
        setFetchError(msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [concertId])

  // ── 결제 타이머 카운트다운 ────────────────────────────────────
  useEffect(() => {
    if (remainSeconds <= 0) {
      navigate(`/concerts/${concertId}`, { replace: true })
      return
    }
    const id = setInterval(() => setRemainSeconds((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [remainSeconds, concertId, navigate])

  // ── 시간 연장 ─────────────────────────────────────────────────
  const handleExtend = useCallback(async () => {
    if (!reservationId) return
    setPayError(null)
    try {
      const result = await api.post<{ remainSeconds: number }>(
        `/api/reservations/${reservationId}/extend`,
      )
      setRemainSeconds(result.remainSeconds)
      setExtended(true)
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? '시간 연장에 실패했습니다')
        : '시간 연장에 실패했습니다'
      setPayError(msg)
    }
  }, [reservationId])

  // ── 결제 시작 ─────────────────────────────────────────────────
  const handlePay = useCallback(async () => {
    if (!selectedZoneId || !concertId || !concert || !selectedZone || !userId) return
    setIsPaying(true)
    setPayError(null)

    let newReservationId = reservationId

    try {
      // 아직 예매가 없는 경우에만 생성
      if (!newReservationId) {
        const reserved = await api.post<{ reservationId: string; totalPrice: number; remainSeconds: number }>(
          '/api/reservations',
          { concertZoneId: selectedZoneId, quantity },
        )
        newReservationId = reserved.reservationId
        setReservationId(newReservationId)
        setRemainSeconds(reserved.remainSeconds)
      }

      // TossPayments 결제창 (Promise 방식 — PC iframe)
      const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY as string
      const tossPayments = await loadTossPayments(clientKey)
      const payment = tossPayments.payment({ customerKey: userId })

      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: totalPrice },
        orderId: newReservationId,
        orderName: `${concert.title} ${selectedZone.name}`,
        customerName: nickname,
        // 모바일 리다이렉트 대비 (PC에서는 Promise 방식으로 동작, 아래 URL은 모바일 폴백)
        successUrl: `${window.location.origin}/reservations`,
        failUrl: `${window.location.origin}/reservation/${concertId}`,
      })

      // Promise 방식 성공 시 여기까지 도달 (모바일 redirect 시에는 도달 안 함)
      navigate('/reservations', { replace: true })
    } catch (err) {
      // Toss UserCancelError 또는 그 외 에러
      const tossCode = (err as { code?: string }).code
      if (tossCode === 'USER_CANCEL') {
        setPayError('결제를 취소했습니다.')
      } else if (axios.isAxiosError(err)) {
        setPayError(err.response?.data?.message ?? '결제 중 오류가 발생했습니다')
      } else {
        setPayError((err as Error).message ?? '결제 중 오류가 발생했습니다')
      }
    } finally {
      setIsPaying(false)
    }
  }, [selectedZoneId, quantity, concertId, concert, selectedZone, userId, nickname, totalPrice, reservationId, navigate])

  const canPay = !!selectedZoneId && remainSeconds > 0 && !isPaying

  // ── 렌더: 로딩 ──────────────────────────────────────────────
  if (loading) {
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
          <main className="flex-grow pt-16">
            <div
              className={cn(
                'sticky top-16 z-40 h-14 border-b animate-pulse',
                dark ? 'bg-[#1c1f30] border-[#313446]' : 'bg-[#7c3aed]/80 border-[#6d28d9]',
              )}
            />
            <Skeleton dark={dark} />
          </main>
          <Footer dark={dark} />
        </div>
      </div>
    )
  }

  // ── 렌더: 에러 ──────────────────────────────────────────────
  if (fetchError || !concert) {
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
          <main className="flex-grow pt-24 flex flex-col items-center justify-center gap-4 px-5">
            <Icon name="error" className="text-[56px] text-red-500" />
            <h2
              className={cn(
                'font-display font-bold text-xl',
                dark ? 'text-white' : 'text-[#1A1D2E]',
              )}
            >
              공연 정보를 불러올 수 없습니다
            </h2>
            <p className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
              {fetchError}
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => navigate('/')}
                className={cn(
                  'px-5 py-2 rounded-lg text-sm font-medium border transition-all',
                  dark
                    ? 'border-[#4a4455] text-[#ccc3d8] hover:bg-white/5'
                    : 'border-[#DDD8F0] text-[#64748b] hover:bg-[#7c3aed]/5',
                )}
              >
                공연 목록으로
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition-all"
              >
                다시 시도
              </button>
            </div>
          </main>
          <Footer dark={dark} />
        </div>
      </div>
    )
  }

  // ── 렌더: 메인 ──────────────────────────────────────────────
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

        {/* 타이머 배너 */}
        <TimerBanner
          remainSeconds={remainSeconds}
          extended={extended}
          onExtend={handleExtend}
          dark={dark}
        />

        <main className="flex-grow pt-4 pb-16 px-5">
          <div className="max-w-[1200px] mx-auto w-full">
            {/* 브레드크럼 */}
            <div className="mb-6 mt-4">
              <p className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
                <button
                  onClick={() => navigate('/')}
                  className="hover:text-[#7c3aed] transition-colors"
                >
                  공연 목록
                </button>
                {' > '}
                <button
                  onClick={() => navigate(`/concerts/${concertId}`)}
                  className="hover:text-[#7c3aed] transition-colors"
                >
                  {concert.title}
                </button>
                {' > '}
                <span className={dark ? 'text-white' : 'text-[#1A1D2E]'}>구역 선택</span>
              </p>
            </div>

            {/* 공연 정보 요약 */}
            <div
              className={cn(
                'rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4 border',
                dark
                  ? 'bg-[#1A1D2E] border-[#2D3155]'
                  : 'bg-white border-[#DDD8F0] shadow-sm',
              )}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: '#7c3aed20' }}
              >
                <Icon name="music_note" className="text-[#7c3aed] text-[20px]" />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'font-display font-bold text-base truncate',
                    dark ? 'text-white' : 'text-[#1A1D2E]',
                  )}
                >
                  {concert.title}
                </p>
                <p className={cn('text-xs truncate', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
                  {concert.artist} · {concert.venue}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Icon name="calendar_month" className="text-[#7c3aed] text-[16px]" />
                <span className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
                  {formatDate(concert.concertDate)}
                </span>
              </div>
            </div>

            {/* 2단 레이아웃 */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
              {/* 좌: 구역 선택 + 수량 */}
              <div className="space-y-6">
                <div>
                  <h2
                    className={cn(
                      'font-display font-bold text-xl mb-1',
                      dark ? 'text-white' : 'text-[#1A1D2E]',
                    )}
                  >
                    구역 선택
                  </h2>
                  <p className={cn('text-sm mb-4', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
                    예매할 구역을 선택하세요. 구역당 최대 4매까지 구매 가능합니다.
                  </p>

                  <div className="space-y-3">
                    {concert.zones.map((zone, i) => (
                      <ZoneCard
                        key={zone.id}
                        zone={zone}
                        selected={selectedZoneId === zone.id}
                        onSelect={() => setSelectedZoneId(zone.id)}
                        dark={dark}
                        index={i}
                      />
                    ))}
                  </div>
                </div>

                {/* 수량 선택 */}
                {selectedZone && (
                  <div
                    className={cn(
                      'rounded-xl p-6 border',
                      dark
                        ? 'bg-[#1A1D2E] border-[#2D3155]'
                        : 'bg-white border-[#DDD8F0] shadow-sm',
                    )}
                  >
                    <h3
                      className={cn(
                        'font-display font-bold text-lg mb-4',
                        dark ? 'text-white' : 'text-[#1A1D2E]',
                      )}
                    >
                      수량 선택
                    </h3>
                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className={cn(
                            'font-semibold',
                            dark ? 'text-white' : 'text-[#1A1D2E]',
                          )}
                        >
                          {selectedZone.name}
                        </p>
                        <p
                          className={cn(
                            'text-sm',
                            dark ? 'text-[#ccc3d8]' : 'text-[#64748b]',
                          )}
                        >
                          {formatNumber(selectedZone.price)}원 / 1매
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                          className={cn(
                            'w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-lg transition-all',
                            quantity <= 1
                              ? 'cursor-not-allowed opacity-40'
                              : 'hover:bg-[#7c3aed]/10 active:scale-95',
                            dark
                              ? 'border-[#4a4455] text-white'
                              : 'border-[#DDD8F0] text-[#1A1D2E]',
                          )}
                        >
                          −
                        </button>
                        <span
                          className={cn(
                            'font-display font-bold text-2xl w-8 text-center',
                            dark ? 'text-white' : 'text-[#1A1D2E]',
                          )}
                        >
                          {quantity}
                        </span>
                        <button
                          onClick={() =>
                            setQuantity((q) =>
                              Math.min(4, q + 1, selectedZone.remainQuantity),
                            )
                          }
                          disabled={quantity >= 4 || quantity >= selectedZone.remainQuantity}
                          className={cn(
                            'w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-lg transition-all',
                            quantity >= 4 || quantity >= selectedZone.remainQuantity
                              ? 'cursor-not-allowed opacity-40'
                              : 'hover:bg-[#7c3aed]/10 active:scale-95',
                            dark
                              ? 'border-[#4a4455] text-white'
                              : 'border-[#DDD8F0] text-[#1A1D2E]',
                          )}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <p
                      className={cn(
                        'text-xs mt-3',
                        dark ? 'text-[#ccc3d8]/70' : 'text-[#64748b]/70',
                      )}
                    >
                      * 1인당 최대 4매까지 구매 가능합니다.
                    </p>
                  </div>
                )}

                {/* 안내 박스 */}
                <div
                  className={cn(
                    'rounded-xl p-5 border',
                    dark
                      ? 'bg-[#1c1412] border-orange-900/40'
                      : 'bg-[#FFF8E6] border-[#D97706]/30',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Icon name="warning" className="text-orange-400 text-[20px] mt-0.5 shrink-0" />
                    <div>
                      <p
                        className={cn(
                          'font-semibold text-sm mb-2',
                          dark ? 'text-orange-300' : 'text-[#92400E]',
                        )}
                      >
                        결제 전 유의사항
                      </p>
                      <ul
                        className={cn(
                          'text-sm space-y-1 list-disc list-inside',
                          dark ? 'text-orange-200/80' : 'text-[#92400E]/80',
                        )}
                      >
                        <li>결제 제한 시간(5분) 내에 결제를 완료해야 합니다.</li>
                        <li>시간 초과 시 선점이 자동 해제되고 다음 대기자에게 기회가 넘어갑니다.</li>
                        <li>시간 연장은 1분 이하 남았을 때 1회에 한해 가능합니다.</li>
                        <li>결제 완료 후 예매 취소는 결제 전 상태에서만 가능합니다.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 우: 주문 요약 (sticky) */}
              <div className="lg:sticky lg:top-32 lg:self-start space-y-4">
                <div
                  className={cn(
                    'rounded-xl border overflow-hidden',
                    dark
                      ? 'bg-[#1A1D2E] border-[#2D3155]'
                      : 'bg-white border-[#DDD8F0] shadow-md',
                  )}
                >
                  <div
                    className={cn(
                      'px-6 py-4 border-b',
                      dark ? 'border-[#2D3155]' : 'border-[#DDD8F0]',
                    )}
                  >
                    <h3
                      className={cn(
                        'font-display font-bold text-lg',
                        dark ? 'text-white' : 'text-[#1A1D2E]',
                      )}
                    >
                      주문 요약
                    </h3>
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    {/* 공연 */}
                    <div className="flex justify-between items-start gap-4">
                      <span
                        className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}
                      >
                        공연
                      </span>
                      <span
                        className={cn(
                          'text-sm font-medium text-right',
                          dark ? 'text-white' : 'text-[#1A1D2E]',
                        )}
                      >
                        {concert.title}
                      </span>
                    </div>

                    {/* 구역 */}
                    <div className="flex justify-between items-center">
                      <span
                        className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}
                      >
                        구역
                      </span>
                      {selectedZone ? (
                        <span
                          className={cn(
                            'text-sm font-semibold',
                            dark ? 'text-white' : 'text-[#1A1D2E]',
                          )}
                        >
                          {selectedZone.name}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'text-sm',
                            dark ? 'text-[#4a4455]' : 'text-[#94a3b8]',
                          )}
                        >
                          선택 전
                        </span>
                      )}
                    </div>

                    {/* 수량 */}
                    <div className="flex justify-between items-center">
                      <span
                        className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}
                      >
                        수량
                      </span>
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          dark ? 'text-white' : 'text-[#1A1D2E]',
                        )}
                      >
                        {selectedZone ? `${quantity}매` : '—'}
                      </span>
                    </div>

                    {/* 단가 */}
                    {selectedZone && (
                      <div className="flex justify-between items-center">
                        <span
                          className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}
                        >
                          단가
                        </span>
                        <span
                          className={cn(
                            'text-sm',
                            dark ? 'text-[#ccc3d8]' : 'text-[#64748b]',
                          )}
                        >
                          {formatNumber(selectedZone.price)}원 × {quantity}매
                        </span>
                      </div>
                    )}

                    {/* 구분선 */}
                    <div
                      className={cn(
                        'border-t pt-4',
                        dark ? 'border-[#2D3155]' : 'border-[#DDD8F0]',
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className={cn(
                            'font-semibold',
                            dark ? 'text-white' : 'text-[#1A1D2E]',
                          )}
                        >
                          총 결제 금액
                        </span>
                        <span className="font-display font-bold text-2xl text-[#7c3aed]">
                          {formatNumber(totalPrice)}
                          <span className="text-base ml-0.5">원</span>
                        </span>
                      </div>
                    </div>

                    {/* 에러 메시지 */}
                    {payError && (
                      <div
                        className={cn(
                          'rounded-lg p-3 flex items-start gap-2 border text-sm',
                          dark
                            ? 'bg-red-950/50 border-red-800/50 text-red-300'
                            : 'bg-red-50 border-red-200 text-red-700',
                        )}
                      >
                        <Icon name="error" className="text-[16px] mt-0.5 shrink-0" />
                        {payError}
                      </div>
                    )}

                    {/* 결제 버튼 */}
                    <button
                      onClick={handlePay}
                      disabled={!canPay}
                      className={cn(
                        'w-full py-4 rounded-xl font-display font-bold text-lg transition-all flex items-center justify-center gap-2',
                        canPay
                          ? 'bg-[#7c3aed] text-white hover:bg-[#6d28d9] active:scale-[0.98] shadow-lg shadow-[#7c3aed]/30'
                          : dark
                            ? 'bg-[#2D3155] text-[#4a4455] cursor-not-allowed'
                            : 'bg-[#DDD8F0] text-[#94a3b8] cursor-not-allowed',
                      )}
                    >
                      {isPaying ? (
                        <>
                          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          처리 중…
                        </>
                      ) : (
                        <>
                          <Icon name="payment" className="text-[22px]" />
                          {selectedZone ? '토스페이먼츠로 결제하기' : '구역을 선택하세요'}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 보안 뱃지 */}
                <div
                  className={cn(
                    'rounded-lg p-3 flex items-center gap-2 border',
                    dark
                      ? 'bg-[#1A1D2E] border-[#2D3155]'
                      : 'bg-white border-[#DDD8F0] shadow-sm',
                  )}
                >
                  <Icon name="lock" className="text-emerald-400 text-[18px]" />
                  <p className={cn('text-xs', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
                    결제 정보는 SSL/TLS로 암호화되어 안전하게 처리됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer dark={dark} />
      </div>
    </div>
  )
}
