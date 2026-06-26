import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/api/client'
import { useQueue, type Phase } from '@/hooks/useQueue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ---------------------------------------------------------------------------
// concertId 해석: URL ?concertId=xxx → 없으면 첫 ON_SALE 공연 자동 조회
// ---------------------------------------------------------------------------

function useConcertId() {
  const { concertId: paramId } = useParams<{ concertId: string }>()
  const [concertId, setConcertId] = useState<string | null>(paramId ?? null)
  const [resolveError, setResolveError] = useState<string | null>(null)

  useEffect(() => {
    if (paramId) {
      setConcertId(paramId)
      return
    }
    setResolveError('공연 정보를 찾을 수 없습니다')
  }, [paramId])

  return { concertId, resolveError }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number) {
  return n.toLocaleString('ko-KR')
}

function formatDate(iso: string) {
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
// Shared UI primitives
// ---------------------------------------------------------------------------

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('material-symbols-outlined', className)}>{name}</span>
  )
}

// ---------------------------------------------------------------------------
// Phase views
// ---------------------------------------------------------------------------

function FullPageCenter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      {children}
    </div>
  )
}

function LoadingView({ dark }: { dark: boolean }) {
  return (
    <FullPageCenter>
      <div className="w-12 h-12 rounded-full border-4 border-[#7c3aed]/30 border-t-[#7c3aed] animate-spin" />
      <p className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
        불러오는 중…
      </p>
    </FullPageCenter>
  )
}


function ErrorView({
  dark,
  message,
}: {
  dark: boolean
  message: string
}) {
  return (
    <FullPageCenter>
      <Icon name="error" className="text-[48px] text-red-500" />
      <h2 className={cn('font-display font-bold text-xl', dark ? 'text-white' : 'text-[#1A1D2E]')}>
        공연 정보를 불러올 수 없습니다
      </h2>
      <p className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>{message}</p>
    </FullPageCenter>
  )
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function Navbar({ dark, onToggle, nickname }: { dark: boolean; onToggle: () => void; nickname?: string }) {
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
        <div className="flex items-center gap-2">
          <Icon
            name="confirmation_number"
            className="text-[#7c3aed] text-2xl"
          />
          <span className="font-display font-bold text-[20px] tracking-tighter text-[#7c3aed]">
            VIBE TICKETS
          </span>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm">
          {['공연', '티켓팅', '마이페이지', '고객센터'].map((label) => (
            <a
              key={label}
              href="#"
              className={cn(
                'transition-colors duration-200',
                label === '티켓팅'
                  ? 'text-[#7c3aed] font-bold border-b-2 border-[#7c3aed] pb-1'
                  : dark
                    ? 'text-[#ccc3d8] hover:text-[#7c3aed]'
                    : 'text-[#64748b] hover:text-[#7c3aed]',
              )}
            >
              {label}
            </a>
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
// Concert info card (left column)
// ---------------------------------------------------------------------------

interface ConcertCardProps {
  dark: boolean
  title: string
  artist: string
  venue: string
  concertDate: string
  posterUrl?: string
}

const FALLBACK_POSTER =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAA8SAZECDh87tvQTR0lxwmKHaPp8PKAhA15TAockP4iMZMQg6A0f-oh4AWkusy_66L2B_ZK6BkkNj7F15W294mBAaAL0GAbR8CAWBIL_6RB8Z0rdM4J7BncaEKOVfe6PJdE44_gXmC_ufhBibZMwLMCAIniw-kz7P26DARhuAIq3TzPyqU8tzhelcWk_tdx1TWXisZZivmxdjW3E5dybY3wIHdhWhKEkCxaiim8gai_19pYvflCXvcK87U1EeZ2zuLH_2wv3Cxdg'

function ConcertCard({ dark, title, artist, venue, concertDate, posterUrl }: ConcertCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-6 flex flex-col items-center text-center border',
        dark ? 'bg-[#1A1D2E] border-[#2D3155]' : 'bg-white border-[#DDD8F0] shadow-sm',
      )}
    >
      <div className="w-full aspect-[3/4] mb-4 rounded-lg overflow-hidden border border-[#2D3155]/50 relative">
        <img
          src={posterUrl ?? FALLBACK_POSTER}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3">
          <span className="bg-[#7c3aed] text-white text-xs px-2 py-1 rounded font-bold tracking-wider">
            {artist}
          </span>
        </div>
      </div>

      <h2
        className={cn(
          'font-display font-semibold text-[20px] leading-7 mt-4 mb-1',
          dark ? 'text-white' : 'text-[#1A1D2E]',
        )}
      >
        {title}
      </h2>

      <div className={cn('flex items-center gap-2 text-sm mb-3', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
        <Icon name="location_on" className="text-[18px] text-[#7c3aed]" />
        <span>{venue}</span>
      </div>

      <div className={cn('flex items-center gap-2 text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
        <Icon name="calendar_month" className="text-[18px] text-[#7c3aed]" />
        <span>{formatDate(concertDate)}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Idle view: 대기열 미진입 (진입 버튼)
// ---------------------------------------------------------------------------

interface IdleViewProps {
  dark: boolean
  phase: Phase
  onEnter: () => void
  errorMessage: string | null
  onClearError: () => void
}

function IdleView({ dark, phase, onEnter, errorMessage, onClearError }: IdleViewProps) {
  const isEntering = phase === 'entering'

  return (
    <div className="flex flex-col gap-4">
      {errorMessage && (
        <div
          className={cn(
            'rounded-lg p-4 flex items-start gap-3 border',
            dark ? 'bg-red-950/50 border-red-800/50' : 'bg-red-50 border-red-200',
          )}
        >
          <Icon name="error" className="text-red-500 mt-0.5 text-[20px]" />
          <div className="flex-1">
            <p className={cn('text-sm', dark ? 'text-red-300' : 'text-red-700')}>{errorMessage}</p>
          </div>
          <button onClick={onClearError} className="text-red-400 hover:text-red-300">
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>
      )}

      <div
        className={cn(
          'rounded-xl p-10 flex flex-col items-center justify-center border text-center gap-6',
          dark ? 'bg-[#1A1D2E] border-[#2D3155]' : 'bg-white border-[#DDD8F0] shadow-sm',
        )}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-[#7c3aed]/20 rounded-full blur-2xl pointer-events-none" />
          <Icon name="queue" className="relative z-10 text-[64px] text-[#7c3aed]" />
        </div>
        <div>
          <h3
            className={cn('font-display font-bold text-xl mb-2', dark ? 'text-white' : 'text-[#1A1D2E]')}
          >
            대기열 진입 준비 완료
          </h3>
          <p className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
            아래 버튼을 눌러 대기열에 진입하세요.
            <br />
            순번이 되면 자동으로 입장 처리됩니다.
          </p>
        </div>
        <button
          onClick={onEnter}
          disabled={isEntering}
          className={cn(
            'flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-white transition-all',
            isEntering
              ? 'bg-[#7c3aed]/50 cursor-not-allowed'
              : 'bg-[#7c3aed] hover:bg-[#6d28d9] active:scale-95 shadow-lg shadow-[#7c3aed]/30',
          )}
        >
          {isEntering ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              진입 중…
            </>
          ) : (
            <>
              <Icon name="login" className="text-[20px]" />
              대기열 진입하기
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Queue waiting view (실시간 순번)
// ---------------------------------------------------------------------------

interface QueuePanelProps {
  dark: boolean
  position: number
  total: number
  isConnected: boolean
  onLeave: () => void
}

function QueuePanel({ dark, position, total, isConnected, onLeave }: QueuePanelProps) {
  const peopleAhead = position - 1
  const progressPct = (((total - position) / total) * 100).toFixed(1)
  const estimatedMinutes = Math.ceil(peopleAhead / 3)

  return (
    <div className="flex flex-col gap-4">
      {/* Warning banner */}
      <div
        className={cn(
          'rounded-lg p-4 flex items-start gap-3 border',
          dark ? 'bg-[#2A2210] border-orange-900/50' : 'bg-[#FFF8E6] border-[#D97706]/30',
        )}
      >
        <Icon name="warning" className="text-orange-400 mt-0.5 text-[20px]" />
        <p className={cn('text-sm leading-relaxed', dark ? 'text-orange-200/90' : 'text-[#92400E]')}>
          <strong className="font-semibold block mb-1 text-orange-400">잠시만 기다려주세요</strong>
          새로고침하거나 창을 닫으면 대기 순번을 잃을 수 있습니다. 현재 페이지를 유지해 주세요.
        </p>
      </div>

      {/* Queue number card */}
      <div
        className={cn(
          'rounded-xl p-10 flex flex-col items-center justify-center relative overflow-hidden border',
          dark ? 'bg-[#1A1D2E] border-[#2D3155]' : 'bg-white border-[#DDD8F0] shadow-sm',
        )}
      >
        <div className="absolute inset-0 bg-[#7c3aed]/5 rounded-xl blur-2xl pointer-events-none" />

        <p className={cn('text-sm font-medium mb-2 relative z-10', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
          나의 대기 순번
        </p>

        <div className="flex items-baseline gap-2 mb-4 relative z-10">
          <span
            className={cn(
              'font-display text-[96px] font-extrabold tracking-tighter leading-none px-2 animate-pulse-ring rounded-full',
              dark ? 'gradient-text-dark' : 'gradient-text-light',
            )}
          >
            {formatNumber(position)}
          </span>
          <span className={cn('text-xl font-bold', dark ? 'text-[#d2bbff]' : 'text-[#7c3aed]')}>
            번째
          </span>
        </div>

        <div
          className={cn(
            'px-4 py-2 rounded-full border text-sm relative z-10',
            dark
              ? 'bg-[#26293b] border-[#4a4455] text-[#dfe1f9]'
              : 'bg-[#EDE9FE] border-[#DDD8F0] text-[#1A1D2E]',
          )}
        >
          전체{' '}
          <strong className={dark ? 'text-white' : 'text-[#7c3aed]'}>{formatNumber(total)}</strong>
          명 중 {formatNumber(position)}번째 대기 중
        </div>
      </div>

      {/* Progress card */}
      <div
        className={cn(
          'rounded-xl p-6 border',
          dark ? 'bg-[#1A1D2E] border-[#2D3155]' : 'bg-white border-[#DDD8F0] shadow-sm',
        )}
      >
        <div className="flex justify-between items-end mb-3">
          <span className={cn('text-sm font-medium', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
            대기 진행률
          </span>
          <span className={cn('text-2xl font-bold', dark ? 'text-white' : 'text-[#1A1D2E]')}>
            {progressPct}%
          </span>
        </div>
        <div className={cn('w-full h-3 rounded-full overflow-hidden mb-2', dark ? 'bg-[#2D3155]' : 'bg-[#E2DCF8]')}>
          <div
            className="h-full progress-gradient rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className={cn('flex justify-between text-xs font-mono tracking-wider', dark ? 'text-[#ccc3d8]/70' : 'text-[#64748b]/70')}>
          <span>0명</span>
          <span>{formatNumber(total)}명</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: 'timer', label: '예상 대기 시간', value: `약 ${estimatedMinutes}분` },
          { icon: 'group', label: '내 앞 대기자', value: `${formatNumber(peopleAhead)}명` },
          { icon: 'speed', label: '처리 속도', value: '약 3명/분' },
        ].map(({ icon, label, value }) => (
          <div
            key={label}
            className={cn(
              'rounded-lg p-4 flex flex-col items-center text-center border',
              dark ? 'bg-[#1A1D2E] border-[#2D3155]' : 'bg-white border-[#DDD8F0] shadow-sm',
            )}
          >
            <Icon
              name={icon}
              className={cn('mb-1 text-[22px]', dark ? 'text-[#d2bbff] opacity-70' : 'text-[#7c3aed] opacity-80')}
            />
            <span className={cn('text-xs mb-1', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
              {label}
            </span>
            <strong className={cn('text-lg', dark ? 'text-white' : 'text-[#1A1D2E]')}>{value}</strong>
          </div>
        ))}
      </div>

      {/* Status footer */}
      <div className="flex justify-between items-center mt-2 px-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400',
            )}
          />
          <span className={cn('text-xs font-mono tracking-wider', dark ? 'text-[#ccc3d8]/70' : 'text-[#64748b]/70')}>
            {isConnected ? '실시간 연결됨 · WebSocket' : '연결 중…'}
          </span>
        </div>
        <button
          onClick={onLeave}
          className={cn(
            'flex items-center gap-1 text-sm transition-colors duration-200',
            dark ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600',
          )}
        >
          <Icon name="exit_to_app" className="text-[16px]" />
          대기열 이탈
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Admitted banner
// ---------------------------------------------------------------------------

function AdmittedBanner({ dark, onSelectZone }: { dark: boolean; onSelectZone: () => void }) {
  return (
    <div
      className={cn(
        'rounded-xl p-8 flex flex-col items-center text-center gap-4 border',
        dark
          ? 'bg-emerald-950/50 border-emerald-700/50'
          : 'bg-emerald-50 border-emerald-200',
      )}
    >
      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <Icon name="check_circle" className="text-[40px] text-emerald-400" />
      </div>
      <div>
        <h3 className={cn('font-display font-bold text-xl mb-1', dark ? 'text-white' : 'text-[#1A1D2E]')}>
          입장이 허가되었습니다!
        </h3>
        <p className={cn('text-sm', dark ? 'text-emerald-300' : 'text-emerald-700')}>
          5분 안에 구역을 선택하고 결제를 완료하세요.
        </p>
      </div>
      <button
        onClick={onSelectZone}
        className="flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-white bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all shadow-lg shadow-emerald-500/30"
      >
        <Icon name="confirmation_number" className="text-[20px]" />
        구역 선택하러 가기
      </button>
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

export default function QueuePage() {
  const navigate = useNavigate()
  const [dark, setDark] = useState(true)
  const [nickname, setNickname] = useState<string | undefined>(undefined)
  const { concertId, resolveError } = useConcertId()

  useEffect(() => {
    api.get<{ nickname: string }>('/api/auth/me')
      .then((user) => setNickname(user.nickname))
      .catch(() => {/* 401이면 client.ts 인터셉터가 /login으로 리다이렉트 */})
  }, [])

  const {
    phase,
    concert,
    concertError,
    position,
    total,
    isConnected,
    errorMessage,
    enterQueue,
    leaveQueue,
    clearError,
  } = useQueue(concertId)

  // 세션 중 토큰이 소멸한 경우(다른 탭에서 로그아웃 등) 리다이렉트
  useEffect(() => {
    if (phase === 'no_auth') navigate('/login', { replace: true })
  }, [phase, navigate])

  const isQueuePhase = phase === 'in_queue' || phase === 'admitted'

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

        <main className="flex-grow pt-[104px] pb-16 px-5">
          <div className="max-w-[960px] mx-auto w-full">
            {/* 페이지 헤더 */}
            <div className="mb-10">
              <p className={cn('text-sm mb-2', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
                홈 &gt; 티켓팅 &gt; {concert?.title ?? '…'} &gt; 대기열
              </p>
              <h1 className={cn('font-display font-bold text-[28px] leading-tight mb-2', dark ? 'text-white' : 'text-[#1A1D2E]')}>
                실시간 대기열
              </h1>
              <p className={cn('text-lg', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
                잠시만 기다려 주세요. 순번이 되면 자동으로 진행됩니다.
              </p>
            </div>

            {/* 전체 페이지 상태 처리 */}
            {(phase === 'loading' || (!concertId && !resolveError)) && (
              <LoadingView dark={dark} />
            )}

            {resolveError && !concertId && (
              <ErrorView dark={dark} message={resolveError} />
            )}

            {phase === 'concert_error' && (
              <ErrorView dark={dark} message={concertError ?? '알 수 없는 오류'} />
            )}

            {/* 공연 정보 + 대기열 패널 (idle / entering / in_queue / admitted) */}
            {concert && (phase === 'idle' || phase === 'entering' || isQueuePhase) && (
              <div className="flex flex-col md:flex-row gap-10">
                {/* 좌: 공연 정보 */}
                <div className="w-full md:w-[40%]">
                  <ConcertCard
                    dark={dark}
                    title={concert.title}
                    artist={concert.artist}
                    venue={concert.venue}
                    concertDate={concert.concertDate}
                  />
                </div>

                {/* 우: 대기열 패널 */}
                <div className="w-full md:w-[60%]">
                  {phase === 'admitted' && (
                    <AdmittedBanner
                      dark={dark}
                      onSelectZone={() => navigate(`/reservation/${concertId}`)}
                    />
                  )}

                  {(phase === 'idle' || phase === 'entering') && (
                    <IdleView
                      dark={dark}
                      phase={phase}
                      onEnter={enterQueue}
                      errorMessage={errorMessage}
                      onClearError={clearError}
                    />
                  )}

                  {phase === 'in_queue' && position !== null && total !== null && (
                    <QueuePanel
                      dark={dark}
                      position={position}
                      total={total}
                      isConnected={isConnected}
                      onLeave={leaveQueue}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        <Footer dark={dark} />
      </div>
    </div>
  )
}
