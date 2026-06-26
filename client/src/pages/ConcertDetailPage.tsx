import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { api } from '@/api/client'
import { Navbar } from '@/components/Navbar'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConcertStatus = 'SCHEDULED' | 'ON_SALE' | 'SOLD_OUT' | 'ENDED'

interface ConcertZone {
  id: string
  name: string
  price: number
  totalQuantity: number
  remainQuantity: number
}

interface ConcertDetail {
  id: string
  title: string
  artist: string
  venue: string
  concertDate: string
  saleStartAt: string
  status: ConcertStatus
  zones: ConcertZone[]
}

// ---------------------------------------------------------------------------
// useConcertDetail hook
// ---------------------------------------------------------------------------

interface DetailState {
  data: ConcertDetail | null
  loading: boolean
  error: string | null
}

function useConcertDetail(id: string) {
  const [state, setState] = useState<DetailState>({ data: null, loading: true, error: null })

  const fetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const concert = await api.get<ConcertDetail>(`/api/concerts/${id}`)
      setState({ data: concert, loading: false, error: null })
    } catch {
      setState({ data: null, loading: false, error: '공연 정보를 불러오지 못했습니다' })
    }
  }, [id])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { ...state, retry: fetch }
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
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPrice(price: number) {
  return price.toLocaleString('ko-KR') + '원'
}

const ZONE_COLORS_DARK = [
  { name: 'text-[#d2bbff]', bar: 'from-[#7c3aed] to-[#a855f7]' },
  { name: 'text-[#adc6ff]', bar: 'from-[#3b82f6] to-[#60a5fa]' },
  { name: 'text-[#ccc3d8]', bar: 'from-[#6b7280] to-[#9ca3af]' },
]
const ZONE_COLORS_LIGHT = [
  { name: 'text-[#7c3aed]', bar: 'from-[#7c3aed] to-[#a855f7]' },
  { name: 'text-[#3b82f6]', bar: 'from-[#3b82f6] to-[#60a5fa]' },
  { name: 'text-[#6b7280]', bar: 'from-[#9ca3af] to-[#d1d5db]' },
]

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ConcertStatus,
  { label: string; dark: string; light: string; dot?: boolean }
> = {
  ON_SALE: {
    label: '● 판매 중',
    dark: 'bg-emerald-900/80 text-emerald-400 border border-emerald-700/50',
    light: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    dot: true,
  },
  SCHEDULED: {
    label: 'SCHEDULED',
    dark: 'bg-[#313446]/80 text-[#ccc3d8] border border-[#4a4455]/50',
    light: 'bg-gray-100 text-gray-500 border border-gray-200',
  },
  SOLD_OUT: {
    label: 'SOLD OUT',
    dark: 'bg-red-900/80 text-red-400 border border-red-700/50',
    light: 'bg-red-50 text-red-600 border border-red-200',
  },
  ENDED: {
    label: 'ENDED',
    dark: 'bg-[#313446]/80 text-[#958da1] border border-[#4a4455]/50',
    light: 'bg-gray-100 text-gray-400 border border-gray-200',
  },
}

function StatusBadge({ status, dark }: { status: ConcertStatus; dark: boolean }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold tracking-wider',
        dark ? cfg.dark : cfg.light,
      )}
    >
      {cfg.dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
      )}
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Zone card
// ---------------------------------------------------------------------------

function ZoneCard({
  zone,
  dark,
  colorIdx,
}: {
  zone: ConcertZone
  dark: boolean
  colorIdx: number
}) {
  const colors = dark
    ? ZONE_COLORS_DARK[colorIdx] ?? ZONE_COLORS_DARK[2]
    : ZONE_COLORS_LIGHT[colorIdx] ?? ZONE_COLORS_LIGHT[2]

  const isSoldOut = zone.remainQuantity === 0
  const isLow = zone.remainQuantity > 0 && zone.remainQuantity <= 10
  const pct = zone.totalQuantity > 0
    ? Math.round((zone.remainQuantity / zone.totalQuantity) * 100)
    : 0

  return (
    <div
      className={cn(
        'rounded-xl border p-5 flex flex-col gap-3 transition-all duration-300',
        isSoldOut && 'opacity-60',
        dark
          ? 'bg-[#1c1f30] border-[#4a4455]'
          : 'bg-white border-[#e5e7eb] shadow-sm',
      )}
    >
      {/* Zone name + price row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className={cn('font-display font-bold text-[18px]', colors.name)}>
              {zone.name}
            </span>
          </div>
          <span
            className={cn(
              'font-display font-extrabold text-[20px]',
              isSoldOut
                ? dark ? 'text-[#958da1] line-through' : 'text-gray-400 line-through'
                : dark ? 'text-white' : 'text-[#111827]',
            )}
          >
            {formatPrice(zone.price)}
          </span>
        </div>

        {/* Remaining count */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {isSoldOut ? (
            <span
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-mono font-semibold',
                dark
                  ? 'bg-[#93000a] text-[#ffb4ab]'
                  : 'bg-red-100 text-red-600',
              )}
            >
              SOLD OUT
            </span>
          ) : (
            <>
              <span
                className={cn(
                  'font-mono text-sm font-semibold',
                  isLow
                    ? dark ? 'text-[#ffb4ab]' : 'text-red-600'
                    : dark ? 'text-[#4ae176]' : 'text-emerald-600',
                )}
              >
                잔여 {zone.remainQuantity}석
              </span>
              {isLow && (
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold',
                    dark
                      ? 'bg-[#93000a]/60 text-[#ffb4ab]'
                      : 'bg-red-50 text-red-500 border border-red-200',
                  )}
                >
                  마감임박
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Availability bar */}
      <div className={cn('h-1.5 rounded-full overflow-hidden', dark ? 'bg-[#0a0d1d]' : 'bg-gray-100')}>
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all', colors.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton UI
// ---------------------------------------------------------------------------

function SkeletonDetail({ dark }: { dark: boolean }) {
  const shimmer = dark ? 'bg-white/10' : 'bg-gray-200'
  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-pulse">
      {/* Poster */}
      <div className={cn('lg:w-[58%] rounded-xl', shimmer, 'aspect-[3/4] lg:aspect-auto lg:min-h-[480px]')} />
      {/* Info */}
      <div className={cn('lg:w-[42%] rounded-xl border p-7 flex flex-col gap-5',
        dark ? 'bg-[#1c1f30] border-[#4a4455]' : 'bg-white border-[#e5e7eb]')}>
        <div className={cn('h-5 w-20 rounded-full', shimmer)} />
        <div className="flex flex-col gap-2">
          <div className={cn('h-8 w-4/5 rounded', shimmer)} />
          <div className={cn('h-5 w-1/3 rounded', shimmer)} />
        </div>
        <div className="flex flex-col gap-3 mt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className={cn('h-4 w-4 rounded', shimmer)} />
              <div className={cn('h-4 flex-1 rounded', shimmer)} />
            </div>
          ))}
        </div>
        <div className={cn('h-14 w-full rounded-xl mt-auto', shimmer)} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({
  dark,
  message,
  onBack,
  onRetry,
}: {
  dark: boolean
  message: string
  onBack: () => void
  onRetry: () => void
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-24 gap-5 rounded-xl border',
        dark ? 'bg-[#1c1f30] border-[#4a4455] text-[#ccc3d8]' : 'bg-white border-[#e5e7eb] text-[#6b7280]',
      )}
    >
      <Icon name="error_outline" className="text-[64px] text-red-400 opacity-80" />
      <div className="text-center">
        <p className={cn('font-display font-semibold text-lg mb-1', dark ? 'text-white' : 'text-[#111827]')}>
          {message}
        </p>
        <p className="text-sm opacity-70 mb-6">잠시 후 다시 시도해주세요</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onBack}
            className={cn(
              'px-5 h-10 rounded-xl text-sm font-semibold transition-all',
              dark
                ? 'bg-[#313446] text-[#ccc3d8] hover:bg-[#3d4055]'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            목록으로
          </button>
          <button
            onClick={onRetry}
            className="px-5 h-10 rounded-xl text-sm font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] hover:shadow-[0_0_15px_rgba(124,58,237,0.4)] active:scale-95 transition-all"
          >
            다시 시도
          </button>
        </div>
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
          {['이용약관', '개인정보처리방침', '회사소개', '문의하기'].map((link) => (
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

export default function ConcertDetailPage() {
  const { concertId } = useParams<{ concertId: string }>()
  const navigate = useNavigate()
  const [dark, setDark] = useState(true)
  const [nickname, setNickname] = useState<string | undefined>(undefined)

  const id = concertId ?? ''
  const { data: concert, loading, error, retry } = useConcertDetail(id)

  useEffect(() => {
    api
      .get<{ nickname: string }>('/api/auth/me')
      .then((user) => setNickname(user.nickname))
      .catch(() => {})
  }, [])

  // CTA logic
  const allSoldOut = concert
    ? concert.zones.length > 0 && concert.zones.every((z) => z.remainQuantity === 0)
    : false

  const canEnterQueue = concert?.status === 'ON_SALE' && !allSoldOut

  const ctaLabel = () => {
    if (!concert) return ''
    if (concert.status === 'SCHEDULED') return '판매 예정'
    if (concert.status === 'ENDED') return '판매 종료'
    if (allSoldOut) return '매진된 공연입니다'
    return '대기열 진입하기'
  }

  const totalRemain = concert?.zones.reduce((sum, z) => sum + z.remainQuantity, 0) ?? 0
  const totalSeats = concert?.zones.reduce((sum, z) => sum + z.totalQuantity, 0) ?? 0
  const remainPct = totalSeats > 0 ? Math.round((totalRemain / totalSeats) * 100) : 0

  const POSTER_GRADIENT = 'from-purple-900 via-violet-800 to-blue-900'
  const POSTER_GRADIENT_LIGHT = 'from-purple-200 via-violet-100 to-blue-200'

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
          <div className="max-w-[1200px] mx-auto">

            {/* Breadcrumb */}
            <nav className={cn('text-xs font-mono mb-6', dark ? 'text-[#958da1]' : 'text-[#9ca3af]')}>
              <button onClick={() => navigate('/')} className="hover:text-[#7c3aed] transition-colors">
                공연 목록
              </button>
              <span className="mx-2">›</span>
              <span className={dark ? 'text-[#ccc3d8]' : 'text-[#4b5563]'}>
                {concert?.title ?? '공연 상세'}
              </span>
            </nav>

            {/* Loading */}
            {loading && <SkeletonDetail dark={dark} />}

            {/* Error */}
            {!loading && error && (
              <ErrorState
                dark={dark}
                message={error}
                onBack={() => navigate('/')}
                onRetry={retry}
              />
            )}

            {/* Content */}
            {!loading && concert && (
              <div className="flex flex-col gap-10">

                {/* ── Main 2-col section ───────────────────────────────── */}
                <div className="flex flex-col lg:flex-row gap-8">

                  {/* Left: Poster */}
                  <div className="lg:w-[58%] flex-shrink-0">
                    <div
                      className={cn(
                        'relative w-full rounded-2xl overflow-hidden',
                        'min-h-[360px] lg:min-h-[480px]',
                        'bg-gradient-to-br',
                        dark ? POSTER_GRADIENT : POSTER_GRADIENT_LIGHT,
                      )}
                    >
                      {/* Watermark */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Icon name="music_note" className="text-[160px] text-white opacity-10" />
                      </div>
                      {/* Bottom overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      {/* Title overlay */}
                      <div className="absolute bottom-6 left-6 right-6">
                        <p className="font-display font-black text-2xl text-white drop-shadow-lg leading-tight">
                          {concert.title.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right: Info card */}
                  <div
                    className={cn(
                      'lg:w-[42%] rounded-2xl border p-7 flex flex-col gap-5',
                      dark
                        ? 'bg-[#1c1f30] border-[#4a4455]'
                        : 'bg-white border-[#e5e7eb] shadow-[0_4px_20px_rgba(0,0,0,0.06)]',
                    )}
                  >
                    {/* Status badge */}
                    <div>
                      <StatusBadge status={concert.status} dark={dark} />
                    </div>

                    {/* Title & artist */}
                    <div className="flex flex-col gap-1">
                      <h1
                        className={cn(
                          'font-display font-extrabold text-[28px] leading-tight',
                          dark ? 'text-white' : 'text-[#111827]',
                        )}
                      >
                        {concert.title}
                      </h1>
                      <p className={cn('text-lg font-medium', dark ? 'text-[#adc6ff]' : 'text-[#3b82f6]')}>
                        {concert.artist}
                      </p>
                    </div>

                    <div className={cn('border-t', dark ? 'border-[#4a4455]' : 'border-[#f3f4f6]')} />

                    {/* Info rows */}
                    <div className="flex flex-col gap-3">
                      {[
                        { icon: 'calendar_month', label: '공연 일자', value: formatDate(concert.concertDate) },
                        { icon: 'location_on', label: '공연 장소', value: concert.venue },
                        { icon: 'sell', label: '판매 시작', value: formatDate(concert.saleStartAt) },
                      ].map(({ icon, label, value }) => (
                        <div key={label} className="flex items-start gap-3">
                          <Icon
                            name={icon}
                            className={cn(
                              'text-[16px] flex-shrink-0 mt-0.5',
                              dark ? 'text-[#7c3aed]' : 'text-[#7c3aed]',
                            )}
                          />
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className={cn('text-xs font-mono', dark ? 'text-[#958da1]' : 'text-[#9ca3af]')}>
                              {label}
                            </span>
                            <span className={cn('text-sm font-medium leading-snug', dark ? 'text-[#dfe1f9]' : 'text-[#111827]')}>
                              {value}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Remaining seat summary */}
                    {concert.zones.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#6b7280]')}>
                            총 잔여석 {totalRemain.toLocaleString()}석
                          </span>
                          <span className={cn('text-xs font-mono', dark ? 'text-[#958da1]' : 'text-[#9ca3af]')}>
                            {remainPct}%
                          </span>
                        </div>
                        <div className={cn('h-2 rounded-full overflow-hidden', dark ? 'bg-[#0a0d1d]' : 'bg-gray-100')}>
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#7c3aed] transition-all"
                            style={{ width: `${remainPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* CTA button */}
                    <div className="flex flex-col gap-2 mt-auto pt-2">
                      {canEnterQueue ? (
                        <button
                          onClick={() => navigate(`/queue/${concert.id}`)}
                          className={cn(
                            'w-full h-14 rounded-xl font-display font-bold text-lg text-white',
                            'bg-[#7c3aed] hover:bg-[#6d28d9] active:scale-[0.98]',
                            'transition-all duration-200',
                            'hover:shadow-[0_0_20px_rgba(124,58,237,0.6)]',
                            'flex items-center justify-center gap-2',
                          )}
                        >
                          대기열 진입하기
                          <Icon name="arrow_forward" className="text-[20px]" />
                        </button>
                      ) : (
                        <button
                          disabled
                          className={cn(
                            'w-full h-14 rounded-xl font-display font-bold text-lg cursor-not-allowed',
                            'flex items-center justify-center transition-all',
                            allSoldOut
                              ? dark
                                ? 'bg-[#93000a]/40 text-[#ffb4ab]'
                                : 'bg-red-50 text-red-400'
                              : dark
                                ? 'bg-[#313446] text-[#958da1]'
                                : 'bg-gray-100 text-gray-400',
                          )}
                        >
                          {ctaLabel()}
                        </button>
                      )}
                      <p className={cn('text-xs text-center', dark ? 'text-[#958da1]' : 'text-[#9ca3af]')}>
                        {canEnterQueue
                          ? '지금 바로 대기열에 참여하세요'
                          : concert.status === 'SCHEDULED'
                            ? `${formatDate(concert.saleStartAt)} 부터 예매 가능`
                            : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Zone ticket info ──────────────────────────────────── */}
                {concert.zones.length > 0 && (
                  <section className="flex flex-col gap-5">
                    <div className="flex items-center gap-2">
                      <Icon
                        name="confirmation_number"
                        className={cn('text-[22px]', dark ? 'text-[#7c3aed]' : 'text-[#7c3aed]')}
                      />
                      <h2
                        className={cn(
                          'font-display font-bold text-[22px]',
                          dark ? 'text-white' : 'text-[#111827]',
                        )}
                      >
                        구역별 티켓 정보
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {concert.zones.map((zone, i) => (
                        <ZoneCard key={zone.id} zone={zone} dark={dark} colorIdx={i} />
                      ))}
                    </div>
                  </section>
                )}

                {/* ── Notice section ────────────────────────────────────── */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Queue guide */}
                  <div
                    className={cn(
                      'rounded-xl border p-6 flex flex-col gap-4',
                      dark
                        ? 'bg-[#1c1f30] border-[#4a4455]'
                        : 'bg-white border-[#e5e7eb] shadow-sm',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon name="info" className="text-[#7c3aed] text-[20px]" />
                      <h3
                        className={cn(
                          'font-display font-semibold text-[16px]',
                          dark ? 'text-white' : 'text-[#111827]',
                        )}
                      >
                        대기열 방식 안내
                      </h3>
                    </div>
                    <ul
                      className={cn(
                        'flex flex-col gap-2 text-sm leading-relaxed',
                        dark ? 'text-[#ccc3d8]' : 'text-[#4b5563]',
                      )}
                    >
                      {[
                        '대기열 진입 후 순번이 되면 자동으로 입장됩니다',
                        '입장 후 5분 이내 구역 선택 및 결제를 완료해야 합니다',
                        '1인 최대 4매까지 구매 가능합니다',
                        '결제 미완료 시 자동으로 취소됩니다',
                      ].map((text) => (
                        <li key={text} className="flex items-start gap-2">
                          <span className="text-[#7c3aed] flex-shrink-0 mt-0.5">•</span>
                          {text}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Cautions */}
                  <div
                    className={cn(
                      'rounded-xl border p-6 flex flex-col gap-4',
                      dark
                        ? 'bg-[#1c1f30] border-[#93000a]/40'
                        : 'bg-[#fff7ed] border-[#fed7aa]',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon
                        name="warning"
                        className={cn('text-[20px]', dark ? 'text-[#ffb4ab]' : 'text-[#f59e0b]')}
                      />
                      <h3
                        className={cn(
                          'font-display font-semibold text-[16px]',
                          dark ? 'text-[#ffb4ab]' : 'text-[#92400e]',
                        )}
                      >
                        반드시 확인하세요
                      </h3>
                    </div>
                    <ul
                      className={cn(
                        'flex flex-col gap-2 text-sm leading-relaxed',
                        dark ? 'text-[#ccc3d8]' : 'text-[#78350f]',
                      )}
                    >
                      {[
                        '대기 중 새로고침하면 순번이 초기화될 수 있습니다',
                        '브라우저 창을 닫으면 30초 후 대기열에서 제외됩니다',
                        '결제는 반드시 동일 브라우저에서 진행해야 합니다',
                        '부정 접속 적발 시 이용이 제한될 수 있습니다',
                      ].map((text) => (
                        <li key={text} className="flex items-start gap-2">
                          <span
                            className={cn(
                              'flex-shrink-0 mt-0.5',
                              dark ? 'text-[#ffb4ab]' : 'text-[#f59e0b]',
                            )}
                          >
                            •
                          </span>
                          {text}
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

              </div>
            )}
          </div>
        </main>

        <Footer dark={dark} />
      </div>
    </div>
  )
}
