import { useNavigate, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, getRole } from '@/api/client'
import { useTheme } from '@/context/ThemeContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NavbarProps {
  nickname?: string
  adminBadge?: boolean
}

function Icon({ name, className }: { name: string; className?: string }) {
  return <span className={cn('material-symbols-outlined', className)}>{name}</span>
}

const NAV_ITEMS = [
  { label: '공연', href: '/' },
  { label: '마이페이지', href: '/reservations' },
  { label: '고객센터', href: '/support' },
]

function isActive(label: string, pathname: string): boolean {
  switch (label) {
    case '공연':
      return (
        pathname === '/' ||
        pathname.startsWith('/concerts') ||
        pathname.startsWith('/queue') ||
        (pathname.startsWith('/reservation') && !pathname.startsWith('/reservations'))
      )
    case '마이페이지':
      return pathname.startsWith('/reservations')
    case '고객센터':
      return pathname.startsWith('/support')
    default:
      return false
  }
}

export function Navbar({ nickname, adminBadge }: NavbarProps) {
  const { dark, toggleDark } = useTheme()
  const isAdmin = getRole() === 'ADMIN'
  const navigate = useNavigate()
  const { pathname } = useLocation()

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
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Icon name="confirmation_number" className="text-[#7c3aed] text-2xl" />
          <span className="font-display font-bold text-[20px] tracking-tighter text-[#7c3aed]">
            VIBE TICKETS
          </span>
          {adminBadge && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#7c3aed]/20 text-[#d2bbff] border border-[#7c3aed]/40">
              ADMIN
            </span>
          )}
        </button>

        <div className="hidden md:flex items-center gap-6 text-sm">
          {NAV_ITEMS.map(({ label, href }) => {
            const active = isActive(label, pathname)
            return (
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
            )
          })}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleDark}
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
                  <span
                    className={cn(
                      'w-12 h-3.5 rounded animate-pulse',
                      dark ? 'bg-white/10' : 'bg-[#7c3aed]/10',
                    )}
                  />
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn(
                'w-44',
                dark
                  ? 'bg-[#1c1f30] border-[#2D3155] text-[#dfe1f9]'
                  : 'bg-white border-[#DDD8F0] text-[#1A1D2E]',
              )}
            >
              <DropdownMenuItem
                className={cn(
                  'cursor-pointer gap-2 text-sm',
                  dark ? 'focus:bg-[#26293b] focus:text-white' : 'focus:bg-[#F5F3FF] focus:text-[#1A1D2E]',
                )}
                onClick={() => navigate('/reservations')}
              >
                <Icon name="confirmation_number" className="text-[15px]" />
                예매 내역
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuItem
                    className={cn(
                      'cursor-pointer gap-2 text-sm',
                      dark ? 'focus:bg-[#26293b] focus:text-white' : 'focus:bg-[#F5F3FF] focus:text-[#1A1D2E]',
                    )}
                    onClick={() => navigate('/admin')}
                  >
                    <Icon name="admin_panel_settings" className="text-[15px]" />
                    공연 관리
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={cn(
                      'cursor-pointer gap-2 text-sm',
                      dark ? 'focus:bg-[#26293b] focus:text-white' : 'focus:bg-[#F5F3FF] focus:text-[#1A1D2E]',
                    )}
                    onClick={() => navigate('/admin/support')}
                  >
                    <Icon name="forum" className="text-[15px]" />
                    고객센터 관리
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator className={dark ? 'bg-[#2D3155]' : 'bg-[#DDD8F0]'} />
              <DropdownMenuItem
                className={cn(
                  'cursor-pointer gap-2 text-sm',
                  dark
                    ? 'text-[#f87171] focus:bg-red-950/50 focus:text-red-400'
                    : 'text-red-500 focus:bg-red-50 focus:text-red-600',
                )}
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
