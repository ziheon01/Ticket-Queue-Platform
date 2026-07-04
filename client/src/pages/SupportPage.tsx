import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { api } from '@/api/client'
import { useTheme } from '@/context/ThemeContext'
import { Navbar } from '@/components/Navbar'

// ── Types ─────────────────────────────────────────────────────────────────────

type PostStatus = 'PENDING' | 'ANSWERED'

interface PostSummary {
  id: string
  title: string
  status: PostStatus
  createdAt: string
}

interface PostDetail extends PostSummary {
  content: string
  reply: { id: string; content: string; createdAt: string } | null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function usePosts() {
  const [data, setData] = useState<PostSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.get<PostSummary[]>('/api/posts'))
    } catch {
      setError('문의 내역을 불러오지 못했습니다')
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
    .replace('.', '')
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

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({
  dark,
  onClose,
  onSuccess,
}: {
  dark: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputCls = cn(
    'w-full px-3.5 py-2.5 rounded-xl text-sm border outline-none transition-all duration-200',
    'focus:ring-1 focus:ring-[#7c3aed]/50 focus:border-[#7c3aed]',
    dark
      ? 'bg-[#0a0d1d] border-[#2D3155] text-[#dfe1f9] placeholder:text-[#4a4455]'
      : 'bg-[#F5F3FF] border-[#DDD8F0] text-[#1A1D2E] placeholder:text-[#94a3b8]',
  )

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 모두 입력해주세요')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await api.post('/api/posts', { title: title.trim(), content: content.trim() })
      onSuccess()
    } catch {
      setError('문의 제출에 실패했습니다. 다시 시도해주세요')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 w-full max-w-[560px] rounded-2xl border p-8 shadow-2xl',
          dark ? 'bg-[#1c1f30] border-[#2D3155]' : 'bg-white border-[#DDD8F0]',
        )}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className={cn('font-display font-bold text-lg', dark ? 'text-white' : 'text-[#1A1D2E]')}>
            문의 작성
          </h2>
          <button
            onClick={onClose}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              dark
                ? 'text-[#958da1] hover:text-[#dfe1f9] hover:bg-white/10'
                : 'text-[#64748b] hover:text-[#1A1D2E] hover:bg-[#F5F3FF]',
            )}
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        <div className={cn('border-t mb-6', dark ? 'border-[#2D3155]' : 'border-[#EDE9FE]')} />

        <div className="flex flex-col gap-5">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-[#958da1] mb-2">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="문의 제목을 입력해주세요"
              maxLength={200}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-[#958da1] mb-2">
              내용
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="문의 내용을 상세히 입력해주세요"
              rows={6}
              className={cn(inputCls, 'resize-none leading-relaxed')}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-red-900/20 border border-red-800/40 text-red-400 text-sm flex items-center gap-2">
            <Icon name="error" className="text-[16px]" />
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
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
            disabled={loading || !title.trim() || !content.trim()}
            className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] hover:shadow-[0_0_15px_rgba(124,58,237,0.4)] active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                제출 중…
              </span>
            ) : '제출'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({
  postId,
  dark,
  onClose,
}: {
  postId: string
  dark: boolean
  onClose: () => void
}) {
  const [post, setPost] = useState<PostDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<PostDetail>(`/api/posts/${postId}`)
      .then(setPost)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [postId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 w-full max-w-[600px] rounded-2xl border p-8 shadow-2xl max-h-[85vh] overflow-y-auto',
          dark ? 'bg-[#1c1f30] border-[#2D3155]' : 'bg-white border-[#DDD8F0]',
        )}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className={cn('font-display font-bold text-lg', dark ? 'text-white' : 'text-[#1A1D2E]')}>
            문의 상세
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

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-6 h-6 border-2 border-[#7c3aed]/30 border-t-[#7c3aed] rounded-full animate-spin" />
          </div>
        ) : !post ? (
          <p className="text-center py-12 text-[#958da1] text-sm">내용을 불러오지 못했습니다</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className={cn('font-display font-bold text-base leading-snug', dark ? 'text-white' : 'text-[#1A1D2E]')}>
                {post.title}
              </h3>
              <StatusBadge status={post.status} />
            </div>
            <p className="font-mono text-xs text-[#958da1] mb-5">
              작성일: {formatDate(post.createdAt)}
            </p>

            <p className="text-[11px] font-mono uppercase tracking-widest text-[#958da1] mb-2">문의 내용</p>
            <div
              className={cn(
                'rounded-xl border p-4 text-sm leading-relaxed whitespace-pre-wrap',
                dark
                  ? 'bg-[#0a0d1d] border-[#2D3155] text-[#ccc3d8]'
                  : 'bg-[#F5F3FF] border-[#DDD8F0] text-[#1A1D2E]',
              )}
            >
              {post.content}
            </div>

            <div className={cn('border-t my-5', dark ? 'border-[#2D3155]' : 'border-[#EDE9FE]')} />

            {post.reply ? (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-[#4ae176] mb-2 flex items-center gap-1.5">
                  <Icon name="check_circle" className="text-[14px]" />
                  답변 완료
                </p>
                <div
                  className={cn(
                    'rounded-xl border p-4 text-sm leading-relaxed whitespace-pre-wrap',
                    dark
                      ? 'bg-[#0d2a1a] border-[#166534]/60 text-[#ccc3d8]'
                      : 'bg-green-50 border-green-200 text-[#1A1D2E]',
                  )}
                >
                  {post.reply.content}
                </div>
                <p className="mt-1.5 font-mono text-xs text-[#958da1]">
                  답변일: {formatDate(post.reply.createdAt)}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-mono uppercase tracking-widest text-[#958da1] mb-2">답변</p>
                <div
                  className={cn(
                    'rounded-xl border p-6 flex flex-col items-center gap-2',
                    dark ? 'bg-[#0f1223] border-[#2D3155]' : 'bg-[#F5F3FF] border-[#DDD8F0]',
                  )}
                >
                  <Icon name="schedule" className="text-[32px] text-[#958da1]/60" />
                  <p className="text-sm text-[#958da1]">답변을 준비 중입니다. 잠시만 기다려주세요</p>
                </div>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={onClose}
                className="px-6 h-11 rounded-xl text-sm font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] transition-all duration-200 active:scale-95"
              >
                닫기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────

function DeleteConfirmDialog({
  post,
  dark,
  onConfirm,
  onCancel,
  isLoading,
}: {
  post: PostSummary
  dark: boolean
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div
        className={cn(
          'relative z-10 w-full max-w-sm rounded-2xl border p-6 shadow-2xl',
          dark ? 'bg-[#1c1f30] border-[#2D3155]' : 'bg-white border-[#DDD8F0]',
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-900/40 border border-red-800/50 flex items-center justify-center flex-shrink-0">
            <Icon name="warning" className="text-[20px] text-red-400" />
          </div>
          <div>
            <h3 className={cn('font-display font-bold text-base', dark ? 'text-white' : 'text-[#1A1D2E]')}>
              문의 삭제
            </h3>
            <p className="text-xs text-[#958da1] mt-0.5">삭제 후 되돌릴 수 없습니다</p>
          </div>
        </div>
        <p className={cn('text-sm mb-6 leading-relaxed', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
          <span className={cn('font-semibold', dark ? 'text-white' : 'text-[#1A1D2E]')}>"{post.title}"</span>{' '}
          문의를 삭제하시겠습니까?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className={cn(
              'flex-1 h-10 rounded-xl text-sm font-semibold border transition-all duration-200 disabled:opacity-50',
              dark
                ? 'border-[#4a4455] text-[#ccc3d8] hover:border-[#7c3aed] hover:text-[#d2bbff]'
                : 'border-[#DDD8F0] text-[#64748b] hover:border-[#7c3aed]',
            )}
          >
            돌아가기
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-10 rounded-xl text-sm font-semibold bg-red-700 hover:bg-red-600 text-white transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                삭제 중…
              </span>
            ) : '문의 삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton Row ──────────────────────────────────────────────────────────────

const COLS = '4rem 1fr 9rem 8rem 5rem'

function SkeletonRow({ dark }: { dark: boolean }) {
  const shimmer = dark ? 'bg-white/8 animate-pulse' : 'bg-gray-200 animate-pulse'
  return (
    <div
      className={cn('grid items-center px-5 py-4 border-b last:border-b-0', dark ? 'border-[#2D3155]/50' : 'border-[#DDD8F0]')}
      style={{ gridTemplateColumns: COLS }}
    >
      <div className={cn('h-3 w-5 rounded', shimmer)} />
      <div className={cn('h-4 w-2/3 rounded', shimmer)} />
      <div className={cn('h-5 w-20 rounded-full', shimmer)} />
      <div className={cn('h-3 w-24 rounded', shimmer)} />
      <div />
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ dark, onWrite }: { dark: boolean; onWrite: () => void }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-24 gap-5', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
      <div className={cn('w-20 h-20 rounded-full flex items-center justify-center', dark ? 'bg-[#313446]' : 'bg-[#F5F3FF]')}>
        <Icon name="forum" className="text-[40px] opacity-40" />
      </div>
      <div className="text-center">
        <p className={cn('font-display font-bold text-lg mb-1', dark ? 'text-white' : 'text-[#1A1D2E]')}>
          문의 내역이 없습니다
        </p>
        <p className="text-sm opacity-70">궁금한 점이 있으시면 문의해주세요</p>
      </div>
      <button
        onClick={onWrite}
        className="mt-1 px-6 h-10 rounded-xl text-sm font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] hover:shadow-[0_0_15px_rgba(124,58,237,0.5)] active:scale-95 transition-all duration-200"
      >
        문의하기
      </button>
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
          문의 내역을 불러오지 못했습니다
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
      <div className="max-w-[1200px] mx-auto py-10 px-5 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <span className="font-display font-bold text-[20px] text-[#7c3aed]">VIBE TICKETS</span>
          <span className={cn('opacity-70', dark ? 'text-[#ccc3d8]' : 'text-[#64748b]')}>
            © 2026 VIBE TICKETS. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SupportPage() {
  const { dark } = useTheme()
  const [nickname, setNickname] = useState<string | undefined>(undefined)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PostSummary | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const { data: posts, loading, error, retry } = usePosts()

  useEffect(() => {
    api.get<{ nickname: string }>('/api/auth/me').then((u) => setNickname(u.nickname)).catch(() => {})
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.delete(`/api/posts/${deleteTarget.id}`)
      setDeleteTarget(null)
      retry()
    } catch {
      setDeleteTarget(null)
    } finally {
      setDeleteLoading(false)
    }
  }, [deleteTarget, retry])

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
        <Navbar nickname={nickname} />

        <main className="flex-grow pt-24 pb-16 px-5">
          <div className="max-w-[1000px] mx-auto">
            {/* Page header */}
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs font-mono opacity-60 mb-2 text-[#958da1]">홈 &gt; 고객센터</p>
                <h1 className={cn('font-display font-bold text-[28px] leading-tight', dark ? 'text-white' : 'text-[#1A1D2E]')}>
                  고객센터
                </h1>
              </div>
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold text-white bg-[#7c3aed] hover:bg-[#6d28d9] hover:shadow-[0_0_15px_rgba(124,58,237,0.4)] active:scale-95 transition-all duration-200"
              >
                <Icon name="add" className="text-[18px]" />
                문의하기
              </button>
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
                <span>제목</span>
                <span>상태</span>
                <span>작성일</span>
                <span>관리</span>
              </div>

              {/* Body */}
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} dark={dark} />)
              ) : error ? (
                <ErrorState dark={dark} onRetry={retry} />
              ) : posts.length === 0 ? (
                <EmptyState dark={dark} onWrite={() => setCreateOpen(true)} />
              ) : (
                posts.map((post, idx) => (
                  <div
                    key={post.id}
                    onClick={() => setDetailId(post.id)}
                    className={cn(
                      'grid items-center px-5 py-4 cursor-pointer transition-colors border-b last:border-b-0',
                      dark
                        ? 'border-[#2D3155]/50 hover:bg-[#26293b]/60'
                        : 'border-[#DDD8F0] hover:bg-[#F5F3FF]',
                    )}
                    style={{ gridTemplateColumns: COLS }}
                  >
                    <span className="font-mono text-xs text-[#958da1]">{posts.length - idx}</span>
                    <span className={cn('text-sm font-medium truncate pr-4', dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]')}>
                      {post.title}
                    </span>
                    <div>
                      <StatusBadge status={post.status} />
                    </div>
                    <span className="font-mono text-xs text-[#958da1]">{formatDate(post.createdAt)}</span>
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                      {post.status === 'PENDING' && (
                        <button
                          onClick={() => setDeleteTarget(post)}
                          className="px-2.5 h-7 rounded-lg text-xs font-semibold border transition-all duration-200 border-[#ef4444]/50 text-[#ef4444] hover:bg-red-950/50 hover:border-[#ef4444] active:scale-95"
                        >
                          삭제
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

      {createOpen && (
        <CreateModal
          dark={dark}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => { setCreateOpen(false); retry() }}
        />
      )}
      {detailId && (
        <DetailModal
          postId={detailId}
          dark={dark}
          onClose={() => setDetailId(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmDialog
          post={deleteTarget}
          dark={dark}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteLoading}
        />
      )}
    </>
  )
}
