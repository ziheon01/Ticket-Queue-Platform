import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { api } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConcertStatus = 'SCHEDULED' | 'ON_SALE' | 'SOLD_OUT' | 'ENDED'
type FilterTab = 'ALL' | ConcertStatus

interface Concert {
  id: string
  title: string
  artist: string
  venue: string
  concertDate: string
  saleStartAt: string
  status: ConcertStatus
}

// ---------------------------------------------------------------------------
// useConcerts hook
// ---------------------------------------------------------------------------

interface ConcertsState {
  data: Concert[]
  loading: boolean
  error: string | null
}

function useConcerts() {
  const [state, setState] = useState<ConcertsState>({
    data: [],
    loading: true,
    error: null,
  })

  const fetch = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const list = await api.get<Concert[]>('/api/concerts')
      setState({ data: list, loading: false, error: null })
    } catch {
      setState({ data: [], loading: false, error: '공연 목록을 불러오지 못했습니다' })
    }
  }, [])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { ...state, retry: fetch }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'SCHEDULED', label: '판매 예정' },
  { key: 'ON_SALE', label: '판매 중' },
  { key: 'SOLD_OUT', label: '매진' },
  { key: 'ENDED', label: '판매 종료' },
]

const POSTER_GRADIENTS = [
  'from-purple-900 via-violet-800 to-blue-900',
  'from-blue-900 via-indigo-800 to-purple-900',
  'from-violet-900 via-purple-800 to-pink-900',
  'from-indigo-900 via-blue-800 to-cyan-900',
  'from-pink-900 via-rose-800 to-purple-900',
  'from-cyan-900 via-blue-800 to-indigo-900',
]

const POSTER_GRADIENTS_LIGHT = [
  'from-purple-200 via-violet-100 to-blue-200',
  'from-blue-200 via-indigo-100 to-purple-200',
  'from-violet-200 via-purple-100 to-pink-200',
  'from-indigo-200 via-blue-100 to-cyan-200',
  'from-pink-200 via-rose-100 to-purple-200',
  'from-cyan-200 via-blue-100 to-indigo-200',
]

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

function formatConcertDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ConcertStatus,
  { label: string; className: string; dot?: boolean }
> = {
  ON_SALE: {
    label: 'ON SALE',
    className: 'bg-emerald-900/80 text-emerald-400 border border-emerald-700/50',
    dot: true,
  },
  SCHEDULED: {
    label: 'SCHEDULED',
    className: 'bg-[#313446]/80 text-[#ccc3d8] border border-[#4a4455]/50',
  },
  SOLD_OUT: {
    label: 'SOLD OUT',
    className: 'bg-red-900/80 text-red-400 border border-red-700/50',
  },
  ENDED: {
    label: 'ENDED',
    className: 'bg-[#313446]/80 text-[#958da1] border border-[#4a4455]/50',
  },
}

const STATUS_CONFIG_LIGHT: Record<
  ConcertStatus,
  { label: string; className: string; dot?: boolean }
> = {
  ON_SALE: {
    label: 'ON SALE',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    dot: true,
  },
  SCHEDULED: {
    label: 'SCHEDULED',
    className: 'bg-gray-100 text-gray-500 border border-gray-200',
  },
  SOLD_OUT: {
    label: 'SOLD OUT',
    className: 'bg-red-50 text-red-600 border border-red-200',
  },
  ENDED: {
    label: 'ENDED',
    className: 'bg-gray-100 text-gray-400 border border-gray-200',
  },
}

function StatusBadge({ status, dark }: { status: ConcertStatus; dark: boolean }) {
  const config = dark ? STATUS_CONFIG[status] : STATUS_CONFIG_LIGHT[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono font-semibold tracking-widest uppercase',
        config.className,
      )}
    >
      {config.dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
      )}
      {config.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Skeleton card (loading)
// ---------------------------------------------------------------------------

function SkeletonCard({ dark }: { dark: boolean }) {
  const shimmer = dark ? 'bg-white/10' : 'bg-gray-200'
  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden border',
        dark ? 'bg-[#1c1f30] border-[#4a4455]' : 'bg-white border-[#e5e7eb]',
      )}
    >
      {/* poster */}
      <div className={cn('w-full aspect-video animate-pulse', shimmer)} />
      {/* body */}
      <div className="p-5 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <div className={cn('h-4 w-3/4 rounded animate-pulse', shimmer)} />
          <div className={cn('h-3 w-1/3 rounded animate-pulse', shimmer)} />
        </div>
        <div className="flex flex-col gap-2">
          <div className={cn('h-3 w-1/2 rounded animate-pulse', shimmer)} />
          <div className={cn('h-3 w-2/3 rounded animate-pulse', shimmer)} />
        </div>
        <div className={cn('border-t pt-3', dark ? 'border-[#4a4455]' : 'border-[#f3f4f6]')}>
          <div className="flex justify-between items-center">
            <div className={cn('h-3 w-1/4 rounded animate-pulse', shimmer)} />
            <div className={cn('h-9 w-24 rounded-lg animate-pulse', shimmer)} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Concert card
// ---------------------------------------------------------------------------

function ConcertCard({
  concert,
  dark,
  index,
  onBook,
}: {
  concert: Concert
  dark: boolean
  index: number
  onBook: (id: string) => void
}) {
  const gradients = dark ? POSTER_GRADIENTS : POSTER_GRADIENTS_LIGHT
  const gradient = gradients[index % gradients.length]
  const isEnded = concert.status === 'ENDED'

  const labelMap: Record<ConcertStatus, string> = {
    ON_SALE: '티켓 예매',
    SCHEDULED: '판매 예정',
    SOLD_OUT: '매진',
    ENDED: '판매 종료',
  }

  return (
    <div
      className={cn(
        'group rounded-xl overflow-hidden border transition-all duration-300',
        'hover:-translate-y-1.5 hover:shadow-xl',
        dark
          ? 'bg-[#1c1f30] border-[#4a4455] hover:border-[#7c3aed] hover:shadow-[#7c3aed]/10'
          : 'bg-white border-[#e5e7eb] hover:border-[#7c3aed] hover:shadow-[#7c3aed]/15',
      )}
    >
      {/* Poster */}
      <div className="relative">
        <div className={cn('w-full aspect-video bg-gradient-to-br', gradient)}>
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <Icon name="music_note" className="text-[80px] text-white" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
        <div className="absolute top-3 left-3">
          <StatusBadge status={concert.status} dark={dark} />
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-3">
        <div>
          <h3
            className={cn(
              'font-display font-bold text-[17px] leading-snug line-clamp-2 mb-1',
              isEnded
                ? dark
                  ? 'text-[#958da1] line-through'
                  : 'text-gray-400 line-through'
                : dark
                  ? 'text-white'
                  : 'text-[#111827]',
            )}
          >
            {concert.title}
          </h3>
          <p className={cn('text-sm font-medium', dark ? 'text-[#adc6ff]' : 'text-[#3b82f6]')}>
            {concert.artist}
          </p>
        </div>

        <div className={cn('flex flex-col gap-1.5 text-xs', dark ? 'text-[#ccc3d8]' : 'text-[#4b5563]')}>
          <div className="flex items-center gap-1.5">
            <Icon name="calendar_month" className="text-[14px] opacity-60 flex-shrink-0" />
            <span>{formatConcertDate(concert.concertDate)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Icon name="location_on" className="text-[14px] opacity-60 flex-shrink-0" />
            <span className="truncate">{concert.venue}</span>
          </div>
        </div>

        <div className={cn('border-t pt-3', dark ? 'border-[#4a4455]' : 'border-[#f3f4f6]')}>
          <div className="flex items-center justify-end">
            {concert.status === 'ON_SALE' ? (
              <button
                onClick={() => onBook(concert.id)}
                className={cn(
                  'px-4 h-9 rounded-lg text-sm font-semibold font-display text-white',
                  'bg-[#7c3aed] hover:bg-[#6d28d9] active:scale-95 transition-all duration-200',
                  'hover:shadow-[0_0_15px_rgba(124,58,237,0.5)]',
                )}
              >
                티켓 예매
              </button>
            ) : (
              <button
                disabled
                className={cn(
                  'px-4 h-9 rounded-lg text-sm font-semibold cursor-not-allowed',
                  dark
                    ? 'bg-[#313446] text-[#958da1]'
                    : concert.status === 'SOLD_OUT'
                      ? 'bg-red-50 text-red-400'
                      : 'bg-gray-100 text-gray-400',
                )}
              >
                {labelMap[concert.status]}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ dark, tab }: { dark: boolean; tab: FilterTab }) {
  const labelMap: Record<FilterTab, string> = {
    ALL: '공연',
    SCHEDULED: '판매 예정 공연',
    ON_SALE: '판매 중인 공연',
    SOLD_OUT: '매진 공연',
    ENDED: '종료된 공연',
  }
  return (
    <div
      className={cn(
        'col-span-full flex flex-col items-center justify-center py-20 gap-4 rounded-xl border',
        dark ? 'bg-[#1c1f30] border-[#4a4455] text-[#ccc3d8]' : 'bg-white border-[#e5e7eb] text-[#6b7280]',
      )}
    >
      <Icon name="confirmation_number" className="text-[56px] opacity-30" />
      <div className="text-center">
        <p className="font-semibold text-base mb-1">현재 {labelMap[tab]}이 없습니다</p>
        <p className="text-sm opacity-70">다른 탭을 선택해보세요</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ dark, message, onRetry }: { dark: boolean; message: string; onRetry: () => void }) {
  return (
    <div
      className={cn(
        'col-span-full flex flex-col items-center justify-center py-20 gap-4 rounded-xl border',
        dark ? 'bg-[#1c1f30] border-[#4a4455] text-[#ccc3d8]' : 'bg-white border-[#e5e7eb] text-[#6b7280]',
      )}
    >
      <Icon name="error_outline" className="text-[56px] text-red-400 opacity-80" />
      <div className="text-center">
        <p className="font-semibold text-base mb-1">{message}</p>
        <p className="text-sm opacity-70 mb-4">잠시 후 다시 시도해주세요</p>
        <button
          onClick={onRetry}
          className={cn(
            'px-5 h-9 rounded-lg text-sm font-semibold transition-all duration-200',
            'bg-[#7c3aed] text-white hover:bg-[#6d28d9] hover:shadow-[0_0_15px_rgba(124,58,237,0.4)] active:scale-95',
          )}
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function Navbar({ dark, onToggle, nickname }: { dark: boolean; onToggle: () => void; nickname?: string }) {
  const navigate = useNavigate()
  return (
    <nav
      className={cn(
        'fixed top-0 w-full z-50 border-b shadow-sm backdrop-blur-md',
        dark ? 'bg-[#0f1223]/80 border-[#313446]' : 'bg-white/85 border-[#DDD8F0]',
      )}
    >
      <div className="flex justify-between items-center h-16 px-5 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-2">
          <Icon name="confirmation_number" className="text-[#7c3aed] text-2xl" />
          <span className="font-display font-bold text-[20px] tracking-tighter text-[#7c3aed]">
            VIBE TICKETS
          </span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm">
          {[
            { label: '공연', active: true, href: '/' },
            { label: '티켓팅', active: false, href: '/' },
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
              dark ? 'text-[#d2bbff] hover:bg-white/10' : 'text-[#7c3aed] hover:bg-[#7c3aed]/5',
            )}
          >
            <Icon name={dark ? 'dark_mode' : 'light_mode'} className="text-[22px]" />
          </button>
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
              <span
                className={cn(
                  'w-12 h-3.5 rounded animate-pulse',
                  dark ? 'bg-white/10' : 'bg-[#7c3aed]/10',
                )}
              />
            )}
          </button>
        </div>
      </div>
    </nav>
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

export default function ConcertsPage() {
  const navigate = useNavigate()
  const [dark, setDark] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const [nickname, setNickname] = useState<string | undefined>(undefined)

  const { data: concerts, loading, error, retry } = useConcerts()

  useEffect(() => {
    api
      .get<{ nickname: string }>('/api/auth/me')
      .then((user) => setNickname(user.nickname))
      .catch(() => {})
  }, [])

  const filtered =
    activeTab === 'ALL' ? concerts : concerts.filter((c) => c.status === activeTab)

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
            {/* Page title */}
            <div className="mb-8">
              <h1
                className={cn(
                  'font-display font-bold text-[32px] leading-tight mb-2',
                  dark ? 'text-white' : 'text-[#1a1a2e]',
                )}
              >
                공연 목록
              </h1>
              <p className={cn('text-base', dark ? 'text-[#ccc3d8]' : 'text-[#6b7280]')}>
                다가오는 콘서트와 공연을 확인해보세요
              </p>
            </div>

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-2 mb-8">
              {FILTER_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                    activeTab === key
                      ? 'bg-[#7c3aed] text-white shadow-[0_0_12px_rgba(124,58,237,0.4)]'
                      : dark
                        ? 'bg-transparent text-[#958da1] border border-[#4a4455] hover:border-[#7c3aed] hover:text-[#d2bbff]'
                        : 'bg-white text-[#6b7280] border border-[#d1d5db] hover:border-[#7c3aed] hover:text-[#7c3aed]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Concert grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <SkeletonCard key={i} dark={dark} />
                ))
              ) : error ? (
                <ErrorState dark={dark} message={error} onRetry={retry} />
              ) : filtered.length === 0 ? (
                <EmptyState dark={dark} tab={activeTab} />
              ) : (
                filtered.map((concert, idx) => (
                  <ConcertCard
                    key={concert.id}
                    concert={concert}
                    dark={dark}
                    index={idx}
                    onBook={(id) => navigate(`/concerts/${id}`)}
                  />
                ))
              )}
            </div>
          </div>
        </main>

        <Footer dark={dark} />
      </div>
    </div>
  )
}
