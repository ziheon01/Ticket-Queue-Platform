import { useState } from 'react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConcertInfo {
  title: string
  artist: string
  venue: string
  date: string
  posterUrl: string
}

interface QueueStatus {
  position: number
  total: number
  estimatedMinutes: number
  processingRate: number
}

// ---------------------------------------------------------------------------
// Dummy data
// ---------------------------------------------------------------------------

const CONCERT: ConcertInfo = {
  title: '2026 IU CONCERT: THE WINNING',
  artist: '아이유 (IU)',
  venue: '잠실 종합운동장 주경기장',
  date: '2026.07.15 (수) 오후 7:00',
  posterUrl:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAA8SAZECDh87tvQTR0lxwmKHaPp8PKAhA15TAockP4iMZMQg6A0f-oh4AWkusy_66L2B_ZK6BkkNj7F15W294mBAaAL0GAbR8CAWBIL_6RB8Z0rdM4J7BncaEKOVfe6PJdE44_gXmC_ufhBibZMwLMCAIniw-kz7P26DARhuAIq3TzPyqU8tzhelcWk_tdx1TWXisZZivmxdjW3E5dybY3wIHdhWhKEkCxaiim8gai_19pYvflCXvcK87U1EeZ2zuLH_2wv3Cxdg',
}

const QUEUE: QueueStatus = {
  position: 1825,
  total: 3520,
  estimatedMinutes: 12,
  processingRate: 3,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number) {
  return n.toLocaleString('ko-KR')
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NavbarProps {
  dark: boolean
  onToggle: () => void
}

function Navbar({ dark, onToggle }: NavbarProps) {
  return (
    <nav
      className={cn(
        'fixed top-0 w-full z-50 border-b shadow-sm backdrop-blur-md',
        dark
          ? 'bg-[#0f1223]/80 border-[#313446]'
          : 'bg-white/85 border-[#DDD8F0]',
      )}
    >
      <div className="flex justify-between items-center h-16 px-5 max-w-[1200px] mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[#7c3aed] text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            confirmation_number
          </span>
          <span className="font-display font-bold text-[20px] tracking-tighter text-[#7c3aed]">
            VIBE TICKETS
          </span>
        </div>

        {/* Nav links */}
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

        {/* Trailing icons */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggle}
            className={cn(
              'p-2 rounded-lg transition-all active:scale-95',
              dark
                ? 'text-[#d2bbff] hover:bg-white/10'
                : 'text-[#7c3aed] hover:bg-[#7c3aed]/5',
            )}
            aria-label="테마 전환"
          >
            <span className="material-symbols-outlined text-[22px]">
              {dark ? 'dark_mode' : 'light_mode'}
            </span>
          </button>
          <button
            className={cn(
              'flex items-center gap-2 p-2 rounded-lg transition-all active:scale-95',
              dark
                ? 'text-[#d2bbff] hover:bg-white/10'
                : 'text-[#7c3aed] hover:bg-[#7c3aed]/5',
            )}
          >
            <span className="material-symbols-outlined text-[22px]">account_circle</span>
            <span className="text-sm font-medium">홍길동</span>
          </button>
        </div>
      </div>
    </nav>
  )
}

interface ConcertCardProps {
  concert: ConcertInfo
  dark: boolean
}

function ConcertCard({ concert, dark }: ConcertCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-6 flex flex-col items-center text-center border',
        dark
          ? 'bg-[#1A1D2E] border-[#2D3155]'
          : 'bg-white border-[#DDD8F0] shadow-sm',
      )}
    >
      {/* Poster */}
      <div className="w-full aspect-[3/4] mb-4 rounded-lg overflow-hidden border relative border-[#2D3155]/50">
        <img
          src={concert.posterUrl}
          alt={concert.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3">
          <span className="bg-[#7c3aed] text-white text-xs px-2 py-1 rounded font-bold tracking-wider">
            {concert.artist}
          </span>
        </div>
      </div>

      {/* Info */}
      <h2
        className={cn(
          'font-display font-semibold text-[20px] leading-7 mt-4 mb-1',
          dark ? 'text-white' : 'text-[#1A1D2E]',
        )}
      >
        {concert.title}
      </h2>

      <div
        className={cn(
          'flex items-center gap-2 text-sm mb-3',
          dark ? 'text-[#ccc3d8]' : 'text-[#64748b]',
        )}
      >
        <span className="material-symbols-outlined text-[18px] text-[#7c3aed]">
          location_on
        </span>
        <span>{concert.venue}</span>
      </div>

      <div
        className={cn(
          'flex items-center gap-2 text-sm',
          dark ? 'text-[#ccc3d8]' : 'text-[#64748b]',
        )}
      >
        <span className="material-symbols-outlined text-[18px] text-[#7c3aed]">
          calendar_month
        </span>
        <span>{concert.date}</span>
      </div>
    </div>
  )
}

interface QueuePanelProps {
  queue: QueueStatus
  dark: boolean
}

function QueuePanel({ queue, dark }: QueuePanelProps) {
  const { position, total, estimatedMinutes, processingRate } = queue
  const peopleAhead = position - 1
  const progressPct = (((total - position) / total) * 100).toFixed(1)

  return (
    <div className="flex flex-col gap-4">
      {/* Warning banner */}
      <div
        className={cn(
          'rounded-lg p-4 flex items-start gap-3 border',
          dark
            ? 'bg-[#2A2210] border-orange-900/50'
            : 'bg-[#FFF8E6] border-[#D97706]/30',
        )}
      >
        <span className="material-symbols-outlined text-orange-400 mt-0.5 text-[20px]">
          warning
        </span>
        <p
          className={cn(
            'text-sm leading-relaxed',
            dark ? 'text-orange-200/90' : 'text-[#92400E]',
          )}
        >
          <strong className="font-semibold block mb-1 text-orange-400">
            잠시만 기다려주세요
          </strong>
          새로고침하거나 창을 닫으면 대기 순번을 잃을 수 있습니다. 현재 페이지를 유지해
          주세요.
        </p>
      </div>

      {/* Queue number card */}
      <div
        className={cn(
          'rounded-xl p-10 flex flex-col items-center justify-center relative overflow-hidden border',
          dark ? 'bg-[#1A1D2E] border-[#2D3155]' : 'bg-white border-[#DDD8F0] shadow-sm',
        )}
      >
        {/* Background glow */}
        <div className="absolute inset-0 bg-[#7c3aed]/5 rounded-xl blur-2xl pointer-events-none" />

        <p
          className={cn(
            'text-sm font-medium mb-2 relative z-10',
            dark ? 'text-[#ccc3d8]' : 'text-[#64748b]',
          )}
        >
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
          <span
            className={cn(
              'text-xl font-bold',
              dark ? 'text-[#d2bbff]' : 'text-[#7c3aed]',
            )}
          >
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
          <strong className={dark ? 'text-white' : 'text-[#7c3aed]'}>
            {formatNumber(total)}
          </strong>
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
          <span
            className={cn('text-sm font-medium', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}
          >
            대기 진행률
          </span>
          <span
            className={cn('text-2xl font-bold', dark ? 'text-white' : 'text-[#1A1D2E]')}
          >
            {progressPct}%
          </span>
        </div>

        <div
          className={cn(
            'w-full h-3 rounded-full overflow-hidden mb-2',
            dark ? 'bg-[#2D3155]' : 'bg-[#E2DCF8]',
          )}
        >
          <div
            className="h-full progress-gradient rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div
          className={cn(
            'flex justify-between text-xs font-mono tracking-wider',
            dark ? 'text-[#ccc3d8]/70' : 'text-[#64748b]/70',
          )}
        >
          <span>0명</span>
          <span>{formatNumber(total)}명</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: 'timer', label: '예상 대기 시간', value: `약 ${estimatedMinutes}분` },
          { icon: 'group', label: '내 앞 대기자', value: `${formatNumber(peopleAhead)}명` },
          { icon: 'speed', label: '처리 속도', value: `약 ${processingRate}명/분` },
        ].map(({ icon, label, value }) => (
          <div
            key={label}
            className={cn(
              'rounded-lg p-4 flex flex-col items-center text-center border',
              dark
                ? 'bg-[#1A1D2E] border-[#2D3155]'
                : 'bg-white border-[#DDD8F0] shadow-sm',
            )}
          >
            <span
              className={cn(
                'material-symbols-outlined mb-1 text-[22px]',
                dark ? 'text-[#d2bbff] opacity-70' : 'text-[#7c3aed] opacity-80',
              )}
            >
              {icon}
            </span>
            <span
              className={cn(
                'text-xs mb-1',
                dark ? 'text-[#ccc3d8]' : 'text-[#64748b]',
              )}
            >
              {label}
            </span>
            <strong
              className={cn('text-lg', dark ? 'text-white' : 'text-[#1A1D2E]')}
            >
              {value}
            </strong>
          </div>
        ))}
      </div>

      {/* Status footer */}
      <div className="flex justify-between items-center mt-2 px-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span
            className={cn(
              'text-xs font-mono tracking-wider',
              dark ? 'text-[#ccc3d8]/70' : 'text-[#64748b]/70',
            )}
          >
            실시간 연결됨 · WebSocket
          </span>
        </div>

        <button
          className={cn(
            'flex items-center gap-1 text-sm transition-colors duration-200',
            dark
              ? 'text-red-400 hover:text-red-300'
              : 'text-red-500 hover:text-red-600',
          )}
        >
          <span className="material-symbols-outlined text-[16px]">exit_to_app</span>
          대기열 이탈
        </button>
      </div>
    </div>
  )
}

function Footer({ dark }: { dark: boolean }) {
  const links = ['이용약관', '개인정보처리방침', '회사소개', '문의하기']

  return (
    <footer
      className={cn(
        'mt-16 border-t pb-8 font-mono text-xs',
        dark
          ? 'bg-[#0a0d1d] border-[#313446]'
          : 'bg-[#EDE9FE] border-[#DDD8F0]',
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
          {links.map((link) => (
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

export default function QueuePage() {
  const [dark, setDark] = useState(true)

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
        <Navbar dark={dark} onToggle={() => setDark((d) => !d)} />

        <main className="flex-grow pt-[104px] pb-16 px-5">
          <div className="max-w-[960px] mx-auto w-full">
            {/* Breadcrumb & header */}
            <div className="mb-10">
              <p
                className={cn(
                  'text-sm mb-2',
                  dark ? 'text-[#ccc3d8]' : 'text-[#64748b]',
                )}
              >
                홈 &gt; 티켓팅 &gt; 2026 IU CONCERT &gt; 대기열
              </p>
              <h1
                className={cn(
                  'font-display font-bold text-[28px] leading-tight mb-2',
                  dark ? 'text-white' : 'text-[#1A1D2E]',
                )}
              >
                실시간 대기열
              </h1>
              <p className={cn('text-lg', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
                잠시만 기다려 주세요. 순번이 되면 자동으로 진행됩니다.
              </p>
            </div>

            {/* Two-column layout */}
            <div className="flex flex-col md:flex-row gap-10">
              <div className="w-full md:w-[40%]">
                <ConcertCard concert={CONCERT} dark={dark} />
              </div>
              <div className="w-full md:w-[60%]">
                <QueuePanel queue={QUEUE} dark={dark} />
              </div>
            </div>
          </div>
        </main>

        <Footer dark={dark} />
      </div>
    </div>
  )
}
