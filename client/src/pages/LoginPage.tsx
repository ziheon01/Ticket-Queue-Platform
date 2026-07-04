import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import axios from 'axios'
import { cn } from '@/lib/utils'
import { api, getToken } from '@/api/client'

// ---------------------------------------------------------------------------
// API 응답 타입
// ---------------------------------------------------------------------------

interface LoginResult {
  accessToken: string
  refreshToken: string
  user: { id: string; email: string; nickname: string; role: string }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'login' | 'signup'

// ---------------------------------------------------------------------------
// 에러 메시지 파싱
// ---------------------------------------------------------------------------

function parseApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const serverMsg: string | undefined = err.response?.data?.message
    if (status === 401) return '이메일 또는 비밀번호가 일치하지 않습니다'
    if (status === 409) return '이미 사용 중인 이메일입니다'
    return serverMsg ?? fallback
  }
  return fallback
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('material-symbols-outlined select-none', className)}>
      {name}
    </span>
  )
}

function AlertBanner({
  message,
  dark,
  onClose,
}: {
  message: string
  dark: boolean
  onClose: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg px-4 py-3 mb-6 border text-sm',
        dark
          ? 'bg-red-950/50 border-red-800/50 text-red-300'
          : 'bg-red-50 border-red-200 text-red-700',
      )}
    >
      <Icon name="error" className="text-[18px] mt-0.5 shrink-0" />
      <span className="flex-1 leading-relaxed">{message}</span>
      <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity">
        <Icon name="close" className="text-[16px]" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

function Navbar({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <nav
      className={cn(
        'fixed top-0 w-full z-50 border-b backdrop-blur-md',
        dark
          ? 'bg-[#0f1223]/80 border-[#313446]'
          : 'bg-white/85 border-[#DDD8F0] shadow-sm',
      )}
    >
      <div className="flex justify-between items-center h-16 px-5 max-w-[1200px] mx-auto">
        <a href="/" className="flex items-center gap-2 no-underline">
          <Icon name="confirmation_number" className="text-[#7c3aed] text-2xl" />
          <span className="font-display font-bold text-[20px] tracking-tighter text-[#7c3aed]">
            VIBE TICKETS
          </span>
        </a>

        <div className="hidden md:flex items-center gap-6 text-sm">
          {['공연', '마이페이지', '고객센터'].map((label) => (
            <a
              key={label}
              href="#"
              className={cn(
                'transition-colors duration-200',
                dark
                  ? 'text-[#ccc3d8] hover:text-[#d2bbff]'
                  : 'text-[#64748b] hover:text-[#7c3aed]',
              )}
            >
              {label}
            </a>
          ))}
        </div>

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
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Input field
// ---------------------------------------------------------------------------

interface InputFieldProps {
  label: string
  id: string
  type?: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  dark: boolean
  rightSlot?: React.ReactNode
  autoComplete?: string
  hasError?: boolean
}

function InputField({
  label,
  id,
  type = 'text',
  placeholder,
  value,
  onChange,
  dark,
  rightSlot,
  autoComplete,
  hasError,
}: InputFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className={cn(
          'font-mono text-[11px] font-medium uppercase tracking-[0.05em]',
          dark ? 'text-[#ccc3d8]' : 'text-[#4b5563]',
        )}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full rounded-lg text-sm transition-all duration-200 outline-none border focus:ring-2',
            rightSlot ? 'pl-4 pr-11 py-3' : 'px-4 py-3',
            hasError
              ? dark
                ? 'bg-[#0a0d1d] border-[#ffb4ab]/60 text-[#dfe1f9] placeholder:text-[#4a4455] focus:border-[#ffb4ab] focus:ring-[#ffb4ab]/20'
                : 'bg-white border-red-400 text-[#1c0a3e] placeholder:text-[#9ca3af] focus:border-red-500 focus:ring-red-200'
              : dark
                ? 'bg-[#0a0d1d] border-[#4a4455] text-[#dfe1f9] placeholder:text-[#4a4455] focus:border-[#7c3aed] focus:ring-[#7c3aed]/20'
                : 'bg-white border-[#d1d5db] text-[#1c0a3e] placeholder:text-[#9ca3af] focus:border-[#7c3aed] focus:ring-[#7c3aed]/15',
          )}
        />
        {rightSlot && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Eye toggle
// ---------------------------------------------------------------------------

function EyeToggle({
  visible,
  onToggle,
  dark,
}: {
  visible: boolean
  onToggle: () => void
  dark: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
      className={cn(
        'transition-colors',
        dark ? 'text-[#958da1] hover:text-[#ccc3d8]' : 'text-[#9ca3af] hover:text-[#6b7280]',
      )}
    >
      <Icon name={visible ? 'visibility_off' : 'visibility'} className="text-[20px]" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Primary button
// ---------------------------------------------------------------------------

function PrimaryButton({
  children,
  type = 'button',
  disabled,
}: {
  children: React.ReactNode
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        'w-full h-12 rounded-lg font-display font-semibold text-base text-white',
        'transition-all duration-200',
        disabled
          ? 'bg-[#7c3aed]/50 cursor-not-allowed'
          : 'bg-[#7c3aed] hover:bg-[#6d28d9] hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] active:scale-[0.98]',
      )}
    >
      {disabled ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          처리 중…
        </span>
      ) : (
        children
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Tab title
// ---------------------------------------------------------------------------

function TabTitle({ dark, title, subtitle }: { dark: boolean; title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <h1 className={cn('font-display font-bold text-2xl mb-2', dark ? 'text-[#dfe1f9]' : 'text-[#1c0a3e]')}>
        {title}
      </h1>
      <p className={cn('text-sm', dark ? 'text-[#958da1]' : 'text-[#6b7280]')}>{subtitle}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab switcher
// ---------------------------------------------------------------------------

function TabSwitcher({
  tab,
  dark,
  onTabChange,
}: {
  tab: Tab
  dark: boolean
  onTabChange: (t: Tab) => void
}) {
  return (
    <div className={cn('flex border-b mb-8', dark ? 'border-[#2D3155]' : 'border-[#e5e0f0]')}>
      {(['login', 'signup'] as const).map((t) => {
        const active = tab === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => onTabChange(t)}
            className={cn(
              'flex-1 pb-3 text-sm font-semibold font-display transition-all duration-200 -mb-px border-b-2',
              active
                ? cn('border-[#7c3aed]', dark ? 'text-[#dfe1f9]' : 'text-[#7c3aed]')
                : cn('border-transparent', dark ? 'text-[#958da1] hover:text-[#ccc3d8]' : 'text-[#9ca3af] hover:text-[#6b7280]'),
            )}
          >
            {t === 'login' ? '로그인' : '회원가입'}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Login form
// ---------------------------------------------------------------------------

interface LoginFormProps {
  dark: boolean
  email: string
  password: string
  showPw: boolean
  isLoading: boolean
  errorMessage: string | null
  onEmailChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onTogglePw: () => void
  onClearError: () => void
  onSwitchToSignup: () => void
}

function LoginForm({
  dark,
  email,
  password,
  showPw,
  isLoading,
  errorMessage,
  onEmailChange,
  onPasswordChange,
  onTogglePw,
  onClearError,
  onSwitchToSignup,
}: LoginFormProps) {
  return (
    <div>
      <TabTitle dark={dark} title="다시 만나서 반가워요 👋" subtitle="공연을 예매하려면 로그인하세요" />

      {errorMessage && (
        <AlertBanner message={errorMessage} dark={dark} onClose={onClearError} />
      )}

      <div className="flex flex-col gap-5">
        <InputField
          id="login-email"
          label="이메일"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={onEmailChange}
          dark={dark}
          autoComplete="email"
        />

        <InputField
          id="login-password"
          label="비밀번호"
          type={showPw ? 'text' : 'password'}
          placeholder="비밀번호를 입력하세요"
          value={password}
          onChange={onPasswordChange}
          dark={dark}
          autoComplete="current-password"
          rightSlot={<EyeToggle visible={showPw} onToggle={onTogglePw} dark={dark} />}
        />

        <PrimaryButton type="submit" disabled={isLoading}>
          로그인
        </PrimaryButton>
      </div>

      <p className={cn('text-center text-sm mt-6', dark ? 'text-[#958da1]' : 'text-[#6b7280]')}>
        계정이 없으신가요?{' '}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className={cn(
            'font-semibold underline underline-offset-2 transition-colors',
            dark ? 'text-[#d2bbff] hover:text-[#7c3aed]' : 'text-[#7c3aed] hover:text-[#6d28d9]',
          )}
        >
          회원가입
        </button>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Signup form
// ---------------------------------------------------------------------------

interface SignupFormProps {
  dark: boolean
  email: string
  password: string
  confirm: string
  nickname: string
  showPw: boolean
  showConfirm: boolean
  isLoading: boolean
  errorMessage: string | null
  onEmailChange: (v: string) => void
  onPasswordChange: (v: string) => void
  onConfirmChange: (v: string) => void
  onNicknameChange: (v: string) => void
  onTogglePw: () => void
  onToggleConfirm: () => void
  onClearError: () => void
  onSwitchToLogin: () => void
}

function SignupForm({
  dark,
  email,
  password,
  confirm,
  nickname,
  showPw,
  showConfirm,
  isLoading,
  errorMessage,
  onEmailChange,
  onPasswordChange,
  onConfirmChange,
  onNicknameChange,
  onTogglePw,
  onToggleConfirm,
  onClearError,
  onSwitchToLogin,
}: SignupFormProps) {
  const passwordMismatch = confirm.length > 0 && password !== confirm

  return (
    <div>
      <TabTitle dark={dark} title="VIBE TICKETS 시작하기" subtitle="몇 가지 정보만 입력하면 시작할 수 있어요" />

      {errorMessage && (
        <AlertBanner message={errorMessage} dark={dark} onClose={onClearError} />
      )}

      <div className="flex flex-col gap-5">
        <InputField
          id="signup-email"
          label="이메일"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={onEmailChange}
          dark={dark}
          autoComplete="email"
        />

        <InputField
          id="signup-password"
          label="비밀번호"
          type={showPw ? 'text' : 'password'}
          placeholder="8자 이상 입력하세요"
          value={password}
          onChange={onPasswordChange}
          dark={dark}
          autoComplete="new-password"
          rightSlot={<EyeToggle visible={showPw} onToggle={onTogglePw} dark={dark} />}
        />

        {/* 비밀번호 확인 — 불일치 시 별도 스타일 필요해서 인라인 처리 */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="signup-confirm"
            className={cn(
              'font-mono text-[11px] font-medium uppercase tracking-[0.05em]',
              dark ? 'text-[#ccc3d8]' : 'text-[#4b5563]',
            )}
          >
            비밀번호 확인
          </label>
          <div className="relative">
            <input
              id="signup-confirm"
              type={showConfirm ? 'text' : 'password'}
              placeholder="비밀번호를 다시 입력하세요"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => onConfirmChange(e.target.value)}
              className={cn(
                'w-full pl-4 pr-11 py-3 rounded-lg text-sm transition-all duration-200 outline-none border focus:ring-2',
                passwordMismatch
                  ? dark
                    ? 'bg-[#0a0d1d] border-[#ffb4ab]/60 text-[#dfe1f9] placeholder:text-[#4a4455] focus:border-[#ffb4ab] focus:ring-[#ffb4ab]/20'
                    : 'bg-white border-red-400 text-[#1c0a3e] placeholder:text-[#9ca3af] focus:border-red-500 focus:ring-red-200'
                  : dark
                    ? 'bg-[#0a0d1d] border-[#4a4455] text-[#dfe1f9] placeholder:text-[#4a4455] focus:border-[#7c3aed] focus:ring-[#7c3aed]/20'
                    : 'bg-white border-[#d1d5db] text-[#1c0a3e] placeholder:text-[#9ca3af] focus:border-[#7c3aed] focus:ring-[#7c3aed]/15',
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <EyeToggle visible={showConfirm} onToggle={onToggleConfirm} dark={dark} />
            </div>
          </div>
          {passwordMismatch && (
            <p className={cn('text-xs flex items-center gap-1', dark ? 'text-[#ffb4ab]' : 'text-red-500')}>
              <Icon name="error" className="text-[14px]" />
              비밀번호가 일치하지 않습니다
            </p>
          )}
        </div>

        <InputField
          id="signup-nickname"
          label="닉네임"
          placeholder="콘서트러버"
          value={nickname}
          onChange={onNicknameChange}
          dark={dark}
          autoComplete="nickname"
        />

        <PrimaryButton type="submit" disabled={isLoading || passwordMismatch}>
          회원가입 완료
        </PrimaryButton>
      </div>

      <p className={cn('text-center text-xs mt-4 leading-relaxed', dark ? 'text-[#4a4455]' : 'text-[#9ca3af]')}>
        가입 시{' '}
        <a href="#" className={cn('underline underline-offset-2', dark ? 'text-[#4a4455] hover:text-[#958da1]' : 'hover:text-[#6b7280]')}>
          서비스 이용약관
        </a>{' '}
        및{' '}
        <a href="#" className={cn('underline underline-offset-2', dark ? 'text-[#4a4455] hover:text-[#958da1]' : 'hover:text-[#6b7280]')}>
          개인정보 처리방침
        </a>
        에 동의합니다
      </p>

      <p className={cn('text-center text-sm mt-5', dark ? 'text-[#958da1]' : 'text-[#6b7280]')}>
        이미 계정이 있으신가요?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className={cn(
            'font-semibold underline underline-offset-2 transition-colors',
            dark ? 'text-[#d2bbff] hover:text-[#7c3aed]' : 'text-[#7c3aed] hover:text-[#6d28d9]',
          )}
        >
          로그인
        </button>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer({ dark }: { dark: boolean }) {
  return (
    <footer className={cn('border-t font-mono text-xs', dark ? 'bg-[#0a0d1d] border-[#313446]' : 'bg-[#EDE9FE] border-[#DDD8F0]')}>
      <div className="max-w-[1200px] mx-auto py-8 px-5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <span className="font-display font-bold text-[18px] text-[#7c3aed]">VIBE TICKETS</span>
          <span className={cn('opacity-70', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
            © 2024 VIBE TICKETS. All rights reserved.
          </span>
        </div>
        <div className="flex gap-5">
          {['이용약관', '개인정보처리방침', '회사소개', '문의하기'].map((link) => (
            <a
              key={link}
              href="#"
              className={cn('opacity-70 hover:opacity-100 transition-opacity', dark ? 'text-[#ccc3d8] hover:text-[#7c3aed]' : 'text-[#64748b] hover:text-[#7c3aed]')}
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

export default function LoginPage() {
  const navigate = useNavigate()

  if (getToken()) return <Navigate to="/" replace />

  const [dark, setDark] = useState(true)
  const [tab, setTab] = useState<Tab>('login')
  const [isLoading, setIsLoading] = useState(false)

  // 탭별 에러 — 탭 전환 시 초기화
  const [loginError, setLoginError] = useState<string | null>(null)
  const [signupError, setSignupError] = useState<string | null>(null)

  // 로그인 폼
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPw, setShowLoginPw] = useState(false)

  // 회원가입 폼
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirm, setSignupConfirm] = useState('')
  const [signupNickname, setSignupNickname] = useState('')
  const [showSignupPw, setShowSignupPw] = useState(false)
  const [showSignupConfirm, setShowSignupConfirm] = useState(false)

  function switchTab(t: Tab) {
    setTab(t)
    setLoginError(null)
    setSignupError(null)
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoginError(null)
    setIsLoading(true)
    try {
      const result = await api.post<LoginResult>('/api/auth/login', {
        email: loginEmail,
        password: loginPassword,
      })
      localStorage.setItem('accessToken', result.accessToken)
      localStorage.setItem('refreshToken', result.refreshToken)
      navigate('/')
    } catch (err) {
      setLoginError(parseApiError(err, '로그인 중 오류가 발생했습니다'))
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (signupPassword !== signupConfirm) return
    setSignupError(null)
    setIsLoading(true)
    try {
      // 회원가입
      await api.post('/api/auth/register', {
        email: signupEmail,
        password: signupPassword,
        nickname: signupNickname,
      })
      // 자동 로그인
      const loginResult = await api.post<LoginResult>('/api/auth/login', {
        email: signupEmail,
        password: signupPassword,
      })
      localStorage.setItem('accessToken', loginResult.accessToken)
      localStorage.setItem('refreshToken', loginResult.refreshToken)
      navigate('/')
    } catch (err) {
      setSignupError(parseApiError(err, '회원가입 중 오류가 발생했습니다'))
    } finally {
      setIsLoading(false)
    }
  }

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

        <main className="flex-grow flex items-center justify-center pt-16 px-5 py-16">
          <div className="relative w-full max-w-[480px]">
            {/* Background glow */}
            <div className="absolute inset-0 bg-[#7c3aed]/8 rounded-2xl blur-3xl pointer-events-none" />

            {/* Auth card */}
            <div
              className={cn(
                'relative rounded-2xl border px-10 pt-10 pb-10',
                dark
                  ? 'bg-[#1c1f30] border-[#2D3155]'
                  : 'bg-white border-[#e5e0f0] shadow-[0_8px_32px_rgba(124,58,237,0.08)]',
              )}
            >
              <TabSwitcher tab={tab} dark={dark} onTabChange={switchTab} />

              {tab === 'login' ? (
                <form onSubmit={handleLoginSubmit} noValidate>
                  <LoginForm
                    dark={dark}
                    email={loginEmail}
                    password={loginPassword}
                    showPw={showLoginPw}
                    isLoading={isLoading}
                    errorMessage={loginError}
                    onEmailChange={setLoginEmail}
                    onPasswordChange={setLoginPassword}
                    onTogglePw={() => setShowLoginPw((v) => !v)}
                    onClearError={() => setLoginError(null)}
                    onSwitchToSignup={() => switchTab('signup')}
                  />
                </form>
              ) : (
                <form onSubmit={handleSignupSubmit} noValidate>
                  <SignupForm
                    dark={dark}
                    email={signupEmail}
                    password={signupPassword}
                    confirm={signupConfirm}
                    nickname={signupNickname}
                    showPw={showSignupPw}
                    showConfirm={showSignupConfirm}
                    isLoading={isLoading}
                    errorMessage={signupError}
                    onEmailChange={setSignupEmail}
                    onPasswordChange={setSignupPassword}
                    onConfirmChange={setSignupConfirm}
                    onNicknameChange={setSignupNickname}
                    onTogglePw={() => setShowSignupPw((v) => !v)}
                    onToggleConfirm={() => setShowSignupConfirm((v) => !v)}
                    onClearError={() => setSignupError(null)}
                    onSwitchToLogin={() => switchTab('login')}
                  />
                </form>
              )}
            </div>
          </div>
        </main>

        <Footer dark={dark} />
      </div>
    </div>
  )
}
