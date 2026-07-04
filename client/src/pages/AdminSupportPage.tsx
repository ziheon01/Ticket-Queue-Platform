import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { api } from '@/api/client'
import { useTheme } from '@/context/ThemeContext'
import { Navbar } from '@/components/Navbar'

// ── Types ─────────────────────────────────────────────────────────────────────

type PostStatus = 'PENDING' | 'ANSWERED'

interface AdminPost {
  id: string
  title: string
  content: string
  status: PostStatus
  createdAt: string
  userId: string
  userNickname: string
  reply: { id: string; content: string } | null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function useAdminPosts() {
  const [data, setData] = useState<AdminPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.get<AdminPost[]>('/api/admin/posts'))
    } catch {
      setError('문의 목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPosts() }, [fetchPosts])
  return { data, loading, error, retry: fetchPosts }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Icon({ name, className }: { name: string; className?: string }) {
  return <span className={cn('material-symbols-outlined select-none', className)}>{name}</span>
}

function formatDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '-')
    .replace(/\.$/, '')
}

function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono border whitespace-nowrap',
        status === 'PENDING'
          ? 'bg-[#2A2210] text-[#fbbf24] border-[#92400e]'
          : 'bg-[#14532d]/50 text-[#4ade80] border-[#166534]/70',
      )}
    >
      {status === 'PENDING' ? '답변 대기' : '답변 완료'}
    </span>
  )
}

// ── Reply Modal ───────────────────────────────────────────────────────────────

function ReplyModal({
  post,
  dark,
  onClose,
  onSuccess,
}: {
  post: AdminPost
  dark: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = post.status === 'ANSWERED' && post.reply !== null
  const [content, setContent] = useState(isEdit ? (post.reply?.content ?? '') : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = cn(
    'w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all duration-200 resize-none leading-relaxed',
    'focus:ring-1 focus:ring-[#7c3aed]/50 focus:border-[#7c3aed]',
    dark
      ? 'bg-[#0a0d1d] border-[#2D3155] text-[#dfe1f9] placeholder:text-[#4a4455]'
      : 'bg-[#F5F3FF] border-[#DDD8F0] text-[#1A1D2E] placeholder:text-[#94a3b8]',
  )

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('답변 내용을 입력해주세요')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (isEdit) {
        await api.patch(`/api/admin/posts/${post.id}/reply`, { content: content.trim() })
      } else {
        await api.post(`/api/admin/posts/${post.id}/reply`, { content: content.trim() })
      }
      onSuccess()
    } catch {
      setError('답변 처리에 실패했습니다. 다시 시도해주세요')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 w-full max-w-[620px] rounded-2xl border p-8 shadow-2xl max-h-[85vh] overflow-y-auto',
          dark ? 'bg-[#1c1f30] border-[#2D3155]' : 'bg-white border-[#DDD8F0]',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className={cn('font-display font-bold text-lg', dark ? 'text-white' : 'text-[#1A1D2E]')}>
            {isEdit ? '답변 수정' : '문의 답변'}
          </h2>
          <button
            onClick={onClose}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              dark
                ? 'text-[#958da1] hover:text-[#dfe1f9] hover:bg-white/10'
                : 'text-[#64748b] hover:bg-[#F5F3FF]',
            )}
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className={cn('border-t mb-5', dark ? 'border-[#2D3155]' : 'border-[#EDE9FE]')} />

        {/* Inquiry info (read-only) */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <p className={cn('font-display font-bold text-base', dark ? 'text-white' : 'text-[#1A1D2E]')}>
                {post.title}
              </p>
              <p className="font-mono text-xs text-[#958da1] mt-1">
                작성자: {post.userNickname} · {formatDate(post.createdAt)}
              </p>
            </div>
            <StatusBadge status={post.status} />
          </div>
        </div>

        <p className="text-[11px] font-mono uppercase tracking-widest text-[#958da1] mb-2">문의 내용</p>
        <div
          className={cn(
            'rounded-xl border p-4 text-sm leading-relaxed whitespace-pre-wrap mb-5',
            dark
              ? 'bg-[#0a0d1d] border-[#2D3155] text-[#ccc3d8]'
              : 'bg-[#F5F3FF] border-[#DDD8F0] text-[#1A1D2E]',
          )}
        >
          {post.content}
        </div>

        <div className={cn('border-t mb-5', dark ? 'border-[#2D3155]' : 'border-[#EDE9FE]')} />

        {/* Reply input */}
        <div className="mb-5">
          <label className="block text-[11px] font-mono uppercase tracking-widest text-[#958da1] mb-2">
            답변 내용
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="답변 내용을 입력해주세요"
            rows={5}
            className={inputCls}
          />
        </div>

        {error && (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-red-900/20 border border-red-800/40 text-red-400 text-sm flex items-center gap-2">
            <Icon name="error" className="text-[16px]" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className={cn(
              'flex-1 h-11 rounded-xl text-sm font-semibold border transition-all duration-200 disabled:opacity-50',
              dark
                ? 'border-[#4a4455] text-[#ccc3d8] hover:border-[#7c3aed] hover:text-[#d2bbff]'
                : 'border-[#DDD8F0] text-[#64748b] hover:border-[#7c3aed] hover:text-[#7c3aed]',
            )}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !content.trim()}
            className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] hover:shadow-[0_0_15px_rgba(124,58,237,0.4)] active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                처리 중…
              </span>
            ) : isEdit ? '답변 수정' : '답변 등록'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton Row ──────────────────────────────────────────────────────────────

const COLS = '4rem 9rem 1fr 9rem 8rem 8rem'

function SkeletonRow({ dark }: { dark: boolean }) {
  const shimmer = dark ? 'bg-white/8 animate-pulse' : 'bg-gray-200 animate-pulse'
  return (
    <div
      className={cn('grid items-center px-5 py-4 border-b last:border-b-0', dark ? 'border-[#2D3155]/50' : 'border-[#DDD8F0]')}
      style={{ gridTemplateColumns: COLS }}
    >
      <div className={cn('h-3 w-5 rounded', shimmer)} />
      <div className={cn('h-3 w-20 rounded', shimmer)} />
      <div className={cn('h-4 w-2/3 rounded', shimmer)} />
      <div className={cn('h-5 w-20 rounded-full', shimmer)} />
      <div className={cn('h-3 w-24 rounded', shimmer)} />
      <div className={cn('h-7 w-20 rounded-lg', shimmer)} />
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ dark }: { dark: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-24 gap-5', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
      <div className={cn('w-20 h-20 rounded-full flex items-center justify-center', dark ? 'bg-[#313446]' : 'bg-[#F5F3FF]')}>
        <Icon name="forum" className="text-[40px] opacity-40" />
      </div>
      <div className="text-center">
        <p className={cn('font-display font-bold text-lg mb-1', dark ? 'text-white' : 'text-[#1A1D2E]')}>
          접수된 문의가 없습니다
        </p>
        <p className="text-sm opacity-70">고객 문의가 들어오면 여기에 표시됩니다</p>
      </div>
    </div>
  )
}

// ── Error State ───────────────────────────────────────────────────────────────

function ErrorState({ dark, onRetry }: { dark: boolean; onRetry: () => void }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-24 gap-5', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
      <Icon name="error_outline" className="text-[56px] text-red-400 opacity-80" />
      <div className="text-center">
        <p className={cn('font-display font-bold text-lg mb-1', dark ? 'text-white' : 'text-[#1A1D2E]')}>
          문의 목록을 불러오지 못했습니다
        </p>
        <p className="text-sm opacity-70 mb-5">잠시 후 다시 시도해주세요</p>
        <button
          onClick={onRetry}
          className="px-6 h-10 rounded-xl text-sm font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] transition-all duration-200"
        >
          다시 시도
        </button>
      </div>
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  const { dark } = useTheme()
  return (
    <footer className={cn('mt-16 border-t font-mono text-xs', dark ? 'bg-[#0a0d1d] border-[#313446]' : 'bg-[#EDE9FE] border-[#DDD8F0]')}>
      <div className="max-w-[1200px] mx-auto py-10 px-5 flex items-center gap-6">
        <span className="font-display font-bold text-[20px] text-[#7c3aed]">VIBE TICKETS</span>
        <span className={cn('opacity-70', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
          © 2026 VIBE TICKETS. All rights reserved.
        </span>
      </div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSupportPage() {
  const { dark } = useTheme()
  const [nickname, setNickname] = useState<string | undefined>(undefined)
  const [replyTarget, setReplyTarget] = useState<AdminPost | null>(null)

  const { data: posts, loading, error, retry } = useAdminPosts()

  useEffect(() => {
    api.get<{ nickname: string }>('/api/auth/me').then((u) => setNickname(u.nickname)).catch(() => {})
  }, [])

  return (
    <>
      <div
        className={cn(
          'min-h-screen flex flex-col',
          dark
            ? 'bg-gradient-to-br from-[#0D0F1A] to-[#12142A] text-[#dfe1f9]'
            : 'bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] text-[#1A1D2E]',
        )}
      >
        <Navbar nickname={nickname} adminBadge />

        <main className="flex-grow pt-24 pb-16 px-5">
          <div className="max-w-[1200px] mx-auto">
            {/* Page header */}
            <div className="mb-8">
              <p className="text-xs font-mono opacity-60 mb-2 text-[#958da1]">관리자 &gt; 문의 관리</p>
              <div className="flex items-end justify-between">
                <div>
                  <h1 className={cn('font-display font-bold text-[28px] leading-tight', dark ? 'text-white' : 'text-[#1A1D2E]')}>
                    문의 관리
                  </h1>
                  {!loading && !error && (
                    <p className={cn('text-sm mt-1', dark ? 'text-[#958da1]' : 'text-[#64748b]')}>
                      총 {posts.length}개 문의
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border', dark ? 'bg-[#2A2210] text-[#fbbf24] border-[#92400e]' : 'bg-amber-50 text-amber-600 border-amber-200')}>
                    <Icon name="pending" className="text-[14px]" />
                    대기 {posts.filter((p) => p.status === 'PENDING').length}건
                  </div>
                  <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border', dark ? 'bg-[#14532d]/50 text-[#4ade80] border-[#166534]/70' : 'bg-green-50 text-green-600 border-green-200')}>
                    <Icon name="check_circle" className="text-[14px]" />
                    완료 {posts.filter((p) => p.status === 'ANSWERED').length}건
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className={cn('rounded-2xl border overflow-hidden', dark ? 'bg-[#1c1f30] border-[#2D3155]' : 'bg-white border-[#DDD8F0]')}>
              {/* Header */}
              <div
                className={cn(
                  'grid items-center px-5 py-3 border-b text-[11px] font-mono uppercase tracking-widest text-[#958da1]',
                  dark ? 'bg-[#0f1223] border-[#2D3155]' : 'bg-[#F5F3FF] border-[#DDD8F0]',
                )}
                style={{ gridTemplateColumns: COLS }}
              >
                <span>번호</span>
                <span>작성자</span>
                <span>제목</span>
                <span>상태</span>
                <span>작성일</span>
                <span>액션</span>
              </div>

              {/* Body */}
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} dark={dark} />)
              ) : error ? (
                <ErrorState dark={dark} onRetry={retry} />
              ) : posts.length === 0 ? (
                <EmptyState dark={dark} />
              ) : (
                posts.map((post, idx) => (
                  <div
                    key={post.id}
                    className={cn(
                      'grid items-center px-5 py-4 transition-colors border-b last:border-b-0',
                      dark
                        ? 'border-[#2D3155]/50 hover:bg-[#26293b]/40'
                        : 'border-[#DDD8F0] hover:bg-[#F5F3FF]',
                    )}
                    style={{ gridTemplateColumns: COLS }}
                  >
                    <span className="font-mono text-xs text-[#958da1]">{posts.length - idx}</span>
                    <span className={cn('text-sm truncate', dark ? 'text-[#adc6ff]' : 'text-[#3b82f6]')}>
                      {post.userNickname}
                    </span>
                    <span className={cn('text-sm font-medium truncate pr-4', dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]')}>
                      {post.title}
                    </span>
                    <div>
                      <StatusBadge status={post.status} />
                    </div>
                    <span className="font-mono text-xs text-[#958da1]">{formatDate(post.createdAt)}</span>
                    <div>
                      {post.status === 'PENDING' ? (
                        <button
                          onClick={() => setReplyTarget(post)}
                          className="px-3 h-8 rounded-lg text-xs font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] hover:shadow-[0_0_10px_rgba(124,58,237,0.4)] active:scale-95 transition-all duration-200"
                        >
                          답변하기
                        </button>
                      ) : (
                        <button
                          onClick={() => setReplyTarget(post)}
                          className={cn(
                            'px-3 h-8 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-95',
                            dark
                              ? 'border-[#4a4455] text-[#958da1] hover:border-[#7c3aed] hover:text-[#d2bbff]'
                              : 'border-[#DDD8F0] text-[#64748b] hover:border-[#7c3aed] hover:text-[#7c3aed]',
                          )}
                        >
                          답변 수정
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>

        <Footer />
      </div>

      {replyTarget && (
        <ReplyModal
          post={replyTarget}
          dark={dark}
          onClose={() => setReplyTarget(null)}
          onSuccess={() => { setReplyTarget(null); retry() }}
        />
      )}
    </>
  )
}
