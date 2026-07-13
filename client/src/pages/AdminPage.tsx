import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { getErrorMessage } from '@/lib/errors'
import { api } from '@/api/client'
import { useTheme } from '@/context/ThemeContext'
import { Navbar } from '@/components/Navbar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConcertStatus = 'SCHEDULED' | 'ON_SALE' | 'SOLD_OUT' | 'ENDED'

interface Concert {
  id: string
  title: string
  artist: string
  venue: string
  concertDate: string
  saleStartAt: string
  status: ConcertStatus
}

interface ZoneStat {
  id: string
  name: string
  totalQuantity: number
  remainQuantity: number
  reservationCount: number
}

interface ConcertForm {
  title: string
  artist: string
  venue: string
  concertDate: string
  saleStartAt: string
}

interface ZoneForm {
  name: string
  price: string
  totalQuantity: string
}

const EMPTY_CONCERT_FORM: ConcertForm = {
  title: '',
  artist: '',
  venue: '',
  concertDate: '',
  saleStartAt: '',
}

const EMPTY_ZONE_FORM: ZoneForm = { name: '', price: '', totalQuantity: '' }

interface NewZoneRow {
  _key: string
  name: string
  price: string
  totalQuantity: string
}

function makeZoneRow(): NewZoneRow {
  return { _key: crypto.randomUUID(), name: '', price: '', totalQuantity: '' }
}

// ---------------------------------------------------------------------------
// Icon helper
// ---------------------------------------------------------------------------

function Icon({ name, className }: { name: string; className?: string }) {
  return <span className={cn('material-symbols-outlined', className)}>{name}</span>
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<ConcertStatus, { label: string; className: string }> = {
  SCHEDULED: {
    label: '판매예정',
    className: 'bg-[#313446] text-[#958da1] border border-[#4a4455]',
  },
  ON_SALE: {
    label: '판매중',
    className: 'bg-[#007733]/30 text-[#4ae176] border border-[#007733]',
  },
  SOLD_OUT: {
    label: '매진',
    className: 'bg-[#93000a]/40 text-[#ffb4ab] border border-[#93000a]',
  },
  ENDED: {
    label: '종료',
    className: 'bg-[#1c1f30] text-[#4a4455] border border-[#2D3155]',
  },
}

function StatusBadge({ status }: { status: ConcertStatus }) {
  const { label, className } = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium font-mono',
        className,
      )}
    >
      {status === 'ON_SALE' && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#4ae176] animate-pulse" />
      )}
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function Footer() {
  const { dark } = useTheme()
  return (
    <footer
      className={cn(
        'mt-16 border-t pb-8 font-mono text-xs',
        dark ? 'bg-[#0a0d1d] border-[#313446]' : 'bg-[#EDE9FE] border-[#DDD8F0]',
      )}
    >
      <div className="max-w-[1200px] mx-auto py-10 px-5 flex flex-col md:flex-row justify-between items-center gap-6">
        <span className="font-display font-bold text-[20px] text-[#7c3aed]">VIBE TICKETS</span>
        <div className="flex gap-6">
          {['이용약관', '개인정보처리방침', '취소 및 환불 규정', '사업자정보'].map((link) => (
            <a
              key={link}
              href="#"
              className={cn(
                'transition-colors hover:text-[#7c3aed]',
                dark ? 'text-[#958da1]' : 'text-[#64748b]',
              )}
            >
              {link}
            </a>
          ))}
        </div>
        <span className={dark ? 'text-[#4a4455]' : 'text-[#9ca3af]'}>
          © 2026 VIBE TICKETS. All rights reserved.
        </span>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------------------
// Concert Modal (등록/수정)
// ---------------------------------------------------------------------------

function ConcertModal({
  open,
  mode,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: 'create' | 'edit'
  initial?: Concert
  onClose: () => void
  onSaved: () => void
}) {
  const { dark } = useTheme()
  const inputCls = cn(
    'px-3 py-2 rounded-lg text-sm border',
    dark ? 'bg-[#0a0d1d] border-[#2D3155] text-[#dfe1f9] placeholder:text-[#4a4455]'
         : 'bg-[#F5F3FF] border-[#DDD8F0] text-[#1A1D2E] placeholder:text-[#94a3b8]',
    'focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/30',
    'transition-colors w-full',
  )
  const [form, setForm] = useState<ConcertForm>(EMPTY_CONCERT_FORM)
  const [newZones, setNewZones] = useState<NewZoneRow[]>([makeZoneRow()])
  const [existingZones, setExistingZones] = useState<ZoneStat[]>([])
  const [existingZonesLoading, setExistingZonesLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode === 'edit' && initial) {
      setForm({
        title: initial.title,
        artist: initial.artist,
        venue: initial.venue,
        concertDate: initial.concertDate.slice(0, 16),
        saleStartAt: initial.saleStartAt.slice(0, 16),
      })
      setNewZones([])
      setExistingZonesLoading(true)
      api
        .get<{ zones: ZoneStat[] }>(`/api/admin/concerts/${initial.id}/stats`)
        .then((d) => setExistingZones(d.zones))
        .catch(() => setExistingZones([]))
        .finally(() => setExistingZonesLoading(false))
    } else {
      setForm(EMPTY_CONCERT_FORM)
      setNewZones([makeZoneRow()])
      setExistingZones([])
    }
  }, [open, mode, initial])

  const addZoneRow = () => setNewZones((rows) => [...rows, makeZoneRow()])
  const removeZoneRow = (key: string) =>
    setNewZones((rows) => rows.filter((r) => r._key !== key))
  const updateZoneRow = (key: string, field: keyof Omit<NewZoneRow, '_key'>, value: string) =>
    setNewZones((rows) => rows.map((r) => (r._key === key ? { ...r, [field]: value } : r)))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Zone validation
    if (mode === 'create' && newZones.length === 0) {
      setError('최소 1개 구역을 등록해야 합니다.')
      return
    }
    if (newZones.some((z) => !z.name.trim() || !z.price.trim() || !z.totalQuantity.trim())) {
      setError('모든 구역의 구역명, 가격, 수량을 입력해주세요.')
      return
    }

    setSaving(true)
    setError(null)
    let concertDone = false

    try {
      const concertBody = {
        ...form,
        concertDate: new Date(form.concertDate).toISOString(),
        saleStartAt: new Date(form.saleStartAt).toISOString(),
      }

      let concertId: string
      if (mode === 'create') {
        const created = await api.post<Concert>('/api/admin/concerts', concertBody)
        concertId = created.id
      } else {
        await api.patch(`/api/admin/concerts/${initial!.id}`, concertBody)
        concertId = initial!.id
      }
      concertDone = true

      for (const zone of newZones) {
        await api.post(`/api/admin/concerts/${concertId}/zones`, {
          name: zone.name.trim(),
          price: Number(zone.price),
          totalQuantity: Number(zone.totalQuantity),
        })
      }

      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = getErrorMessage(err, '저장에 실패했습니다.')
      if (concertDone && newZones.length > 0) {
        const prefix = mode === 'create' ? '공연은 생성됐지만' : '공연은 수정됐지만'
        setError(`${prefix} 구역 등록 중 오류가 발생했습니다: ${msg}. 공연 수정에서 구역을 추가해주세요.`)
        onSaved()
      } else {
        setError(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  const fieldInput = (key: keyof ConcertForm, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-mono text-[#958da1] mb-1.5 uppercase tracking-wider">
        {label} *
      </label>
      <input
        type={type}
        required
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2.5 rounded-lg text-sm border',
          dark ? 'bg-[#0a0d1d] border-[#2D3155] text-[#dfe1f9] placeholder:text-[#4a4455]'
               : 'bg-[#F5F3FF] border-[#DDD8F0] text-[#1A1D2E] placeholder:text-[#94a3b8]',
          'focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/30 transition-colors',
        )}
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={cn('max-h-[90vh] overflow-y-auto', dark ? 'bg-[#1c1f30] border border-[#2D3155] text-[#dfe1f9]' : 'bg-white border border-[#DDD8F0] text-[#1A1D2E]')}>
        <form onSubmit={handleSubmit} className="p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className={dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]'}>
              {mode === 'create' ? '공연 등록' : '공연 수정'}
            </DialogTitle>
          </DialogHeader>

          {/* Concert info */}
          <div className="flex flex-col gap-4">
            {fieldInput('title', '공연명', 'text', '공연명을 입력하세요')}
            {fieldInput('artist', '아티스트', 'text', '아티스트명')}
            {fieldInput('venue', '장소', 'text', '공연 장소')}
            {fieldInput('concertDate', '공연 날짜', 'datetime-local')}
            {fieldInput('saleStartAt', '판매 시작 시간', 'datetime-local')}
          </div>

          <div className="my-6 border-t border-[#2D3155]" />

          {/* Edit mode: existing zones (read-only) */}
          {mode === 'edit' && (
            <div className="mb-6">
              <p className="text-xs font-mono text-[#958da1] uppercase tracking-wider mb-3">
                기존 구역
              </p>
              {existingZonesLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-9 bg-[#2D3155]/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : existingZones.length === 0 ? (
                <p className="text-sm text-[#4a4455] italic">등록된 구역이 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {existingZones.map((z) => (
                    <div
                      key={z.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0a0d1d] border border-[#2D3155]"
                    >
                      <span className="text-sm text-[#dfe1f9] font-medium">{z.name}</span>
                      <span className="text-xs font-mono text-[#958da1]">
                        총 {z.totalQuantity.toLocaleString()}석 · 잔여 {z.remainQuantity.toLocaleString()}석
                      </span>
                    </div>
                  ))}
                  <p className="text-[11px] text-[#4a4455] mt-1.5">
                    기존 구역 수정은 판매 현황 패널에서 가능합니다.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* New zones */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-[#958da1] uppercase tracking-wider">
                {mode === 'create' ? (
                  <>구역 추가 <span className="text-[#ffb4ab]">*</span></>
                ) : (
                  '새 구역 추가'
                )}
              </p>
              {newZones.length > 0 && (
                <span className="text-[11px] font-mono text-[#4a4455]">{newZones.length}개</span>
              )}
            </div>

            {newZones.length > 0 && (
              <div className="grid grid-cols-[1fr_110px_90px_32px] gap-2 mb-1.5 px-0.5">
                {['구역명', '가격 (원)', '수량 (석)', ''].map((h) => (
                  <span key={h} className="text-[10px] font-mono text-[#4a4455] uppercase tracking-wider">
                    {h}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {newZones.map((row, idx) => (
                <div key={row._key} className="grid grid-cols-[1fr_110px_90px_32px] gap-2 items-center">
                  <input
                    type="text"
                    placeholder="예: VIP"
                    value={row.name}
                    onChange={(e) => updateZoneRow(row._key, 'name', e.target.value)}
                    className={inputCls}
                  />
                  <input
                    type="number"
                    placeholder="150000"
                    min={0}
                    value={row.price}
                    onChange={(e) => updateZoneRow(row._key, 'price', e.target.value)}
                    className={inputCls}
                  />
                  <input
                    type="number"
                    placeholder="100"
                    min={1}
                    value={row.totalQuantity}
                    onChange={(e) => updateZoneRow(row._key, 'totalQuantity', e.target.value)}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    disabled={mode === 'create' && newZones.length === 1}
                    onClick={() => removeZoneRow(row._key)}
                    aria-label={`구역 ${idx + 1} 삭제`}
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                      mode === 'create' && newZones.length === 1
                        ? 'text-[#2D3155] cursor-not-allowed'
                        : 'text-[#958da1] hover:text-[#ffb4ab] hover:bg-[#93000a]/20',
                    )}
                  >
                    <Icon name="close" className="text-[16px]" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addZoneRow}
              className="mt-3 flex items-center gap-1.5 text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors"
            >
              <Icon name="add_circle" className="text-[16px]" />
              {mode === 'create' ? '+ 구역 추가' : '+ 새 구역 추가'}
            </button>
          </div>

          {error && (
            <p className="mt-4 text-sm text-[#ffb4ab] bg-[#93000a]/30 border border-[#93000a] rounded-lg px-3 py-2 leading-relaxed">
              {error}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm border border-[#4a4455] text-[#958da1] hover:bg-white/5 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className={cn(
                'px-5 py-2 rounded-lg text-sm font-medium bg-[#7c3aed] text-white',
                'hover:bg-[#6d28d9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                'flex items-center gap-2',
              )}
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  저장 중…
                </>
              ) : (
                <>
                  <Icon name="check" className="text-[15px]" />
                  저장하기
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Zone Modal (구역 수정)
// ---------------------------------------------------------------------------

function ZoneModal({
  open,
  zone,
  onClose,
  onSaved,
}: {
  open: boolean
  zone?: ZoneStat
  onClose: () => void
  onSaved: () => void
}) {
  const { dark } = useTheme()
  const inputCls = cn(
    'w-full px-3 py-2.5 rounded-lg text-sm border',
    dark ? 'bg-[#0a0d1d] border-[#2D3155] text-[#dfe1f9] placeholder:text-[#4a4455]'
         : 'bg-[#F5F3FF] border-[#DDD8F0] text-[#1A1D2E] placeholder:text-[#94a3b8]',
    'focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/30 transition-colors',
  )
  const [form, setForm] = useState<ZoneForm>(EMPTY_ZONE_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && zone) {
      setForm({ name: zone.name, price: '', totalQuantity: String(zone.totalQuantity) })
      setError(null)
    }
  }, [open, zone])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!zone) return
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, string | number> = {}
      if (form.name) body.name = form.name
      if (form.price) body.price = Number(form.price)
      if (form.totalQuantity) body.totalQuantity = Number(form.totalQuantity)
      await api.patch(`/api/admin/zones/${zone.id}`, body)
      onSaved()
      onClose()
    } catch (err: unknown) {
      const msg = getErrorMessage(err, '저장에 실패했습니다.')
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={cn(dark ? 'bg-[#1c1f30] border border-[#2D3155] text-[#dfe1f9]' : 'bg-white border border-[#DDD8F0] text-[#1A1D2E]')}>
        <form onSubmit={handleSubmit} className="p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className={dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]'}>구역 수정 — {zone?.name}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {[
              { key: 'name' as const, label: '구역명', type: 'text', ph: zone?.name ?? '' },
              { key: 'price' as const, label: '가격 (원)', type: 'number', ph: '예: 150000' },
              { key: 'totalQuantity' as const, label: '총 수량', type: 'number', ph: String(zone?.totalQuantity ?? '') },
            ].map(({ key, label, type, ph }) => (
              <div key={key}>
                <label className="block text-xs font-mono text-[#958da1] mb-1.5 uppercase tracking-wider">
                  {label}
                </label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={ph}
                  className={inputCls}
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-4 text-sm text-[#ffb4ab] bg-[#93000a]/30 border border-[#93000a] rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm border border-[#4a4455] text-[#958da1] hover:bg-white/5 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-[#7c3aed] text-white hover:bg-[#6d28d9] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  저장 중…
                </>
              ) : (
                <>
                  <Icon name="check" className="text-[15px]" />
                  저장하기
                </>
              )}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Delete Dialog
// ---------------------------------------------------------------------------

function DeleteDialog({
  concert,
  onClose,
  onDeleted,
}: {
  concert: Concert | null
  onClose: () => void
  onDeleted: () => void
}) {
  const { dark } = useTheme()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!concert) return
    setDeleting(true)
    try {
      await api.delete(`/api/admin/concerts/${concert.id}`)
      onDeleted()
      onClose()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={!!concert} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={cn(dark ? 'bg-[#1c1f30] border border-[#2D3155] text-[#dfe1f9]' : 'bg-white border border-[#DDD8F0] text-[#1A1D2E]')}>
        <div className="p-8">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-[#93000a]/30 flex items-center justify-center">
                <Icon name="warning" className="text-[#ffb4ab] text-[20px]" />
              </div>
              <DialogTitle className={dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]'}>공연 삭제</DialogTitle>
            </div>
            <p className={cn('text-sm', dark ? 'text-[#ccc3d8]' : 'text-[#4A3F7A]')}>
              <span className={cn('font-medium', dark ? 'text-white' : 'text-[#1A1D2E]')}>{concert?.title}</span> 공연을 삭제하시겠습니까?
              <br />이 작업은 되돌릴 수 없습니다.
            </p>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm border border-[#4a4455] text-[#958da1] hover:bg-white/5 transition-colors"
            >
              돌아가기
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-5 py-2 rounded-lg text-sm font-medium bg-[#93000a] text-[#ffb4ab] hover:bg-[#7f000a] transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? (
                <span className="w-3.5 h-3.5 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin" />
              ) : (
                <Icon name="delete" className="text-[15px]" />
              )}
              삭제
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Stats Panel
// ---------------------------------------------------------------------------

function StatsPanel({
  concert,
  zones,
  loading,
  onEditZone,
}: {
  concert: Concert
  zones: ZoneStat[]
  loading: boolean
  onEditZone: (zone: ZoneStat) => void
}) {
  const { dark } = useTheme()
  if (loading) {
    return (
      <div className={cn('rounded-xl p-6 animate-pulse border', dark ? 'bg-[#1c1f30] border-[#2D3155]' : 'bg-white border-[#DDD8F0]')}>
        <div className={cn('h-5 rounded w-1/3 mb-4', dark ? 'bg-[#2D3155]' : 'bg-[#DDD8F0]')} />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={cn('h-10 rounded', dark ? 'bg-[#2D3155]' : 'bg-[#DDD8F0]')} />
          ))}
        </div>
      </div>
    )
  }

  const total = zones.reduce(
    (acc, z) => ({
      totalQuantity: acc.totalQuantity + z.totalQuantity,
      remainQuantity: acc.remainQuantity + z.remainQuantity,
      reservationCount: acc.reservationCount + z.reservationCount,
    }),
    { totalQuantity: 0, remainQuantity: 0, reservationCount: 0 },
  )
  const soldTotal = total.totalQuantity - total.remainQuantity
  const soldPct = total.totalQuantity > 0 ? Math.round((soldTotal / total.totalQuantity) * 100) : 0

  return (
    <div className={cn('rounded-xl overflow-hidden border', dark ? 'bg-[#1c1f30] border-[#2D3155]' : 'bg-white border-[#DDD8F0]')}>
      {/* Panel header */}
      <div className={cn('px-6 py-4 border-b flex items-center justify-between', dark ? 'border-[#2D3155]' : 'border-[#DDD8F0]')}>
        <div className="flex items-center gap-3">
          <Icon name="bar_chart" className="text-[#7c3aed] text-[22px]" />
          <div>
            <div className="flex items-center gap-2">
              <span className={cn('font-semibold', dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]')}>{concert.title}</span>
              <StatusBadge status={concert.status} />
            </div>
            <p className="text-xs text-[#958da1] mt-0.5 font-mono">
              {new Date(concert.concertDate).toLocaleDateString('ko-KR')} · {concert.venue} · 판매시작{' '}
              {new Date(concert.saleStartAt).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>
      </div>

      {/* Zone table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={cn('border-b', dark ? 'border-[#2D3155] bg-[#0f1223]' : 'border-[#DDD8F0] bg-[#F5F3FF]')}>
              {['구역', '총 수량', '판매됨', '잔여', '판매율', '예매자 수', ''].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[11px] font-mono text-[#958da1] uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => {
              const sold = zone.totalQuantity - zone.remainQuantity
              const pct = zone.totalQuantity > 0 ? Math.round((sold / zone.totalQuantity) * 100) : 0
              return (
                <tr key={zone.id} className={cn('border-b transition-colors', dark ? 'border-[#2D3155]/50 hover:bg-[#26293b]/50' : 'border-[#DDD8F0] hover:bg-[#F5F3FF]')}>
                  <td className={cn('px-4 py-3 font-medium', dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]')}>{zone.name}</td>
                  <td className={cn('px-4 py-3 font-mono', dark ? 'text-[#ccc3d8]' : 'text-[#4A3F7A]')}>{zone.totalQuantity.toLocaleString()}</td>
                  <td className={cn('px-4 py-3 font-mono', dark ? 'text-[#ccc3d8]' : 'text-[#4A3F7A]')}>{sold.toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono">
                    <span className={zone.remainQuantity <= 10 ? 'text-[#ffb4ab]' : 'text-[#ccc3d8]'}>
                      {zone.remainQuantity.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 min-w-[140px]">
                    <div className="flex items-center gap-2">
                      <div className={cn('flex-1 h-1.5 rounded-full overflow-hidden', dark ? 'bg-[#0a0d1d]' : 'bg-[#DDD8F0]')}>
                        <div
                          className="h-full rounded-full progress-gradient"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-[#958da1] w-8 text-right">{pct}%</span>
                    </div>
                  </td>
                  <td className={cn('px-4 py-3 font-mono', dark ? 'text-[#ccc3d8]' : 'text-[#4A3F7A]')}>{zone.reservationCount.toLocaleString()}명</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onEditZone(zone)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-[#adc6ff] border border-[#0566d9]/40 hover:bg-[#0566d9]/10 transition-colors"
                    >
                      <Icon name="edit" className="text-[13px]" />
                      수정
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={dark ? 'bg-[#0f1223]' : 'bg-[#F5F3FF]'}>
              <td className="px-4 py-3 text-xs font-mono text-[#958da1] uppercase tracking-wider">합계</td>
              <td className={cn('px-4 py-3 font-mono font-medium', dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]')}>{total.totalQuantity.toLocaleString()}</td>
              <td className={cn('px-4 py-3 font-mono font-medium', dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]')}>{soldTotal.toLocaleString()}</td>
              <td className={cn('px-4 py-3 font-mono font-medium', dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]')}>{total.remainQuantity.toLocaleString()}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className={cn('flex-1 h-1.5 rounded-full overflow-hidden', dark ? 'bg-[#0a0d1d]' : 'bg-[#DDD8F0]')}>
                    <div className="h-full rounded-full progress-gradient" style={{ width: `${soldPct}%` }} />
                  </div>
                  <span className={cn('text-[11px] font-mono w-8 text-right font-medium', dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]')}>{soldPct}%</span>
                </div>
              </td>
              <td className={cn('px-4 py-3 font-mono font-medium', dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]')}>{total.reservationCount.toLocaleString()}명</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main AdminPage
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const { dark } = useTheme()
  const [nickname, setNickname] = useState<string | undefined>()

  const [concerts, setConcerts] = useState<Concert[]>([])
  const [concertsLoading, setConcertsLoading] = useState(true)
  const [concertsError, setConcertsError] = useState<string | null>(null)

  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null)
  const [zones, setZones] = useState<ZoneStat[]>([])
  const [zonesLoading, setZonesLoading] = useState(false)

  const [concertModal, setConcertModal] = useState<{ open: boolean; mode: 'create' | 'edit'; concert?: Concert }>({
    open: false,
    mode: 'create',
  })
  const [deleteTarget, setDeleteTarget] = useState<Concert | null>(null)
  const [zoneModal, setZoneModal] = useState<{ open: boolean; zone?: ZoneStat }>({ open: false })

  // Fetch concerts
  const fetchConcerts = useCallback(async () => {
    setConcertsLoading(true)
    setConcertsError(null)
    try {
      const data = await api.get<Concert[]>('/api/concerts')
      setConcerts(data)
    } catch {
      setConcertsError('공연 목록을 불러오지 못했습니다.')
    } finally {
      setConcertsLoading(false)
    }
  }, [])

  // Fetch zone stats for selected concert
  const fetchStats = useCallback(async (concert: Concert) => {
    setZonesLoading(true)
    try {
      const data = await api.get<{ zones: ZoneStat[] }>(`/api/admin/concerts/${concert.id}/stats`)
      setZones(data.zones)
    } catch {
      setZones([])
    } finally {
      setZonesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConcerts()
    api.get<{ nickname: string }>('/api/auth/me').then((d) => setNickname(d.nickname)).catch(() => {})
  }, [fetchConcerts])

  const handleRowClick = (concert: Concert) => {
    setSelectedConcert(concert)
    fetchStats(concert)
  }

  const handleSaved = () => {
    fetchConcerts()
    if (selectedConcert) fetchStats(selectedConcert)
  }

  const handleDeleted = () => {
    fetchConcerts()
    if (selectedConcert?.id === deleteTarget?.id) {
      setSelectedConcert(null)
      setZones([])
    }
  }

  return (
    <>
      <div className={cn('min-h-screen', dark ? 'bg-[#0f1223] text-[#dfe1f9]' : 'bg-[#F5F3FF] text-[#1A1D2E]')}>
        <Navbar
          nickname={nickname}
          adminBadge
        />

        <main className="pt-16">
          <div className="max-w-[1200px] mx-auto px-5 py-10 flex flex-col gap-8">

            {/* Page header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className={cn('text-[28px] font-bold', dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]')}>공연 관리</h1>
                <p className="text-sm text-[#958da1] mt-1">
                  총 {concertsLoading ? '—' : `${concerts.length}개`} 공연
                </p>
              </div>
              <button
                onClick={() => setConcertModal({ open: true, mode: 'create' })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#7c3aed] text-white text-sm font-medium hover:bg-[#6d28d9] transition-all hover:shadow-[0_0_15px_rgba(124,58,237,0.4)] active:scale-95"
              >
                <Icon name="add" className="text-[18px]" />
                공연 등록
              </button>
            </div>

            {/* Concert Table */}
            <div className={cn('rounded-xl overflow-hidden border', dark ? 'bg-[#1c1f30] border-[#2D3155]' : 'bg-white border-[#DDD8F0]')}>
              {/* Table header */}
              <div className={cn('grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b', dark ? 'bg-[#0f1223] border-[#2D3155]' : 'bg-[#F5F3FF] border-[#DDD8F0]')}>
                {['공연명', '아티스트', '공연일', '판매시작일', '상태', '액션'].map((h) => (
                  <span key={h} className="text-[11px] font-mono text-[#958da1] uppercase tracking-wider">
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              {concertsLoading ? (
                <div className={cn('divide-y', dark ? 'divide-[#2D3155]/50' : 'divide-[#DDD8F0]')}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 animate-pulse">
                      <div className={cn('h-4 rounded w-3/4', dark ? 'bg-[#2D3155]' : 'bg-[#DDD8F0]')} />
                      <div className={cn('h-4 rounded w-1/2', dark ? 'bg-[#2D3155]' : 'bg-[#DDD8F0]')} />
                      <div className={cn('h-4 rounded w-2/3', dark ? 'bg-[#2D3155]' : 'bg-[#DDD8F0]')} />
                      <div className={cn('h-4 rounded w-2/3', dark ? 'bg-[#2D3155]' : 'bg-[#DDD8F0]')} />
                      <div className={cn('h-5 rounded-full w-16', dark ? 'bg-[#2D3155]' : 'bg-[#DDD8F0]')} />
                      <div className={cn('h-4 rounded w-20', dark ? 'bg-[#2D3155]' : 'bg-[#DDD8F0]')} />
                    </div>
                  ))}
                </div>
              ) : concertsError ? (
                <div className="px-6 py-12 text-center">
                  <Icon name="error_outline" className="text-[#ffb4ab] text-[40px] mb-3" />
                  <p className="text-[#ffb4ab] mb-4">{concertsError}</p>
                  <button
                    onClick={fetchConcerts}
                    className="px-4 py-2 rounded-lg bg-[#7c3aed] text-white text-sm"
                  >
                    다시 시도
                  </button>
                </div>
              ) : concerts.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <Icon name="event_busy" className={cn('text-[48px] mb-4', dark ? 'text-[#4a4455]' : 'text-[#c4b5fd]')} />
                  <p className="text-[#958da1] mb-6">등록된 공연이 없습니다</p>
                  <button
                    onClick={() => setConcertModal({ open: true, mode: 'create' })}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#7c3aed] text-white text-sm mx-auto"
                  >
                    <Icon name="add" className="text-[18px]" />
                    공연 등록
                  </button>
                </div>
              ) : (
                <div className={cn('divide-y', dark ? 'divide-[#2D3155]/50' : 'divide-[#DDD8F0]')}>
                  {concerts.map((concert) => {
                    const isSelected = selectedConcert?.id === concert.id
                    const isEnded = concert.status === 'ENDED'
                    return (
                      <div
                        key={concert.id}
                        onClick={() => handleRowClick(concert)}
                        className={cn(
                          'grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 cursor-pointer transition-colors',
                          isSelected
                            ? dark ? 'bg-[#26293b] border-l-[3px] border-l-[#7c3aed]' : 'bg-[#EDE9FE] border-l-[3px] border-l-[#7c3aed]'
                            : dark ? 'hover:bg-[#26293b]/60 border-l-[3px] border-l-transparent' : 'hover:bg-[#F5F3FF] border-l-[3px] border-l-transparent',
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn('font-medium truncate', isEnded ? 'text-[#4a4455]' : dark ? 'text-[#dfe1f9]' : 'text-[#1A1D2E]')}>
                            {concert.title}
                          </span>
                          {isSelected && (
                            <Icon name="chevron_right" className="text-[#7c3aed] text-[16px] flex-shrink-0" />
                          )}
                        </div>
                        <span className={cn('text-sm self-center', isEnded ? 'text-[#4a4455]' : dark ? 'text-[#ccc3d8]' : 'text-[#4A3F7A]')}>
                          {concert.artist}
                        </span>
                        <span className={cn('text-sm font-mono self-center', isEnded ? 'text-[#4a4455]' : dark ? 'text-[#ccc3d8]' : 'text-[#4A3F7A]')}>
                          {new Date(concert.concertDate).toLocaleDateString('ko-KR')}
                        </span>
                        <span className={cn('text-sm font-mono self-center', isEnded ? 'text-[#4a4455]' : dark ? 'text-[#ccc3d8]' : 'text-[#4A3F7A]')}>
                          {new Date(concert.saleStartAt).toLocaleDateString('ko-KR')}
                        </span>
                        <div className="self-center">
                          <StatusBadge status={concert.status} />
                        </div>
                        <div
                          className="flex items-center gap-2 self-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => setConcertModal({ open: true, mode: 'edit', concert })}
                            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs text-[#adc6ff] border border-[#0566d9]/40 hover:bg-[#0566d9]/10 transition-colors"
                          >
                            <Icon name="edit" className="text-[13px]" />
                            수정
                          </button>
                          <button
                            onClick={() => setDeleteTarget(concert)}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded text-xs border transition-colors',
                              isEnded
                                ? 'text-[#4a4455] border-[#2D3155] cursor-not-allowed'
                                : 'text-[#ffb4ab] border-[#93000a]/50 hover:bg-[#93000a]/20',
                            )}
                            disabled={isEnded}
                          >
                            <Icon name="delete" className="text-[13px]" />
                            삭제
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Stats Panel */}
            {selectedConcert && (
              <StatsPanel
                concert={selectedConcert}
                zones={zones}
                loading={zonesLoading}
                onEditZone={(zone) => setZoneModal({ open: true, zone })}
              />
            )}
          </div>
        </main>

        <Footer />

        {/* Modals */}
        <ConcertModal
          open={concertModal.open}
          mode={concertModal.mode}
          initial={concertModal.concert}
          onClose={() => setConcertModal((m) => ({ ...m, open: false }))}
          onSaved={handleSaved}
        />

        <ZoneModal
          open={zoneModal.open}
          zone={zoneModal.zone}
          onClose={() => setZoneModal({ open: false })}
          onSaved={handleSaved}
        />

        <DeleteDialog
          concert={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      </div>
    </>
  )
}
