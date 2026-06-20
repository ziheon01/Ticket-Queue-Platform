import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { io, type Socket } from 'socket.io-client'
import { api, getToken } from '@/api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConcertZone {
  id: string
  name: string
  price: number
  totalQuantity: number
  remainQuantity: number
}

export interface Concert {
  id: string
  title: string
  artist: string
  venue: string
  concertDate: string
  saleStartAt: string
  status: string
  zones: ConcertZone[]
}

interface QueueStatusResponse {
  status: 'WAITING' | 'ADMITTED' | 'NOT_IN_QUEUE'
  position?: number
  total?: number
}

export type Phase =
  | 'loading'     // 초기 로딩
  | 'no_auth'     // 미인증
  | 'concert_error' // 공연 조회 실패
  | 'idle'        // 대기열 미진입
  | 'entering'    // 진입 요청 중
  | 'in_queue'    // 대기 중
  | 'admitted'    // 입장 처리됨

export interface UseQueueResult {
  phase: Phase
  concert: Concert | null
  concertError: string | null
  position: number | null
  total: number | null
  isConnected: boolean
  errorMessage: string | null
  enterQueue: () => void
  leaveQueue: () => void
  clearError: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECONNECT_KEY = 'queue_reconnect_id'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQueue(concertId: string | null): UseQueueResult {
  const [phase, setPhase] = useState<Phase>('loading')
  const [concert, setConcert] = useState<Concert | null>(null)
  const [concertError, setConcertError] = useState<string | null>(null)
  const [position, setPosition] = useState<number | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  // 진입 후 소켓 에러 시 idle로 되돌리기 위한 플래그
  const enteringRef = useRef(false)

  // ── 소켓 이벤트 핸들러 등록 ─────────────────────────────────
  const attachSocketEvents = useCallback((socket: Socket, cId: string) => {
    socket.on('connect', () => {
      setIsConnected(true)

      // 30초 유예 재접속: beforeunload에서 저장한 concertId가 일치하면 reconnect
      const savedId = sessionStorage.getItem(RECONNECT_KEY)
      if (savedId === cId) {
        sessionStorage.removeItem(RECONNECT_KEY)
        socket.emit('queue:reconnect', { concertId: cId })
      } else if (enteringRef.current) {
        // 새로운 진입 요청
        socket.emit('queue:enter', { concertId: cId })
      }
    })

    socket.on('disconnect', () => setIsConnected(false))

    socket.on('queue:position', ({ position: pos, total: tot }: { position: number; total: number }) => {
      enteringRef.current = false
      setPosition(pos)
      setTotal(tot)
      setPhase('in_queue')
    })

    socket.on('queue:admitted', () => {
      enteringRef.current = false
      setPhase('admitted')
    })

    socket.on('queue:error', ({ message }: { message: string }) => {
      if (enteringRef.current) {
        enteringRef.current = false
        setPhase('idle')
      }
      setErrorMessage(message)
    })
  }, [])

  // ── 소켓 연결 ────────────────────────────────────────────────
  const connectSocket = useCallback(
    (cId: string) => {
      if (socketRef.current?.connected) return

      const token = getToken()
      if (!token) return

      const socket = io(api.socketUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
      })
      socketRef.current = socket
      attachSocketEvents(socket, cId)
    },
    [attachSocketEvents],
  )

  // ── 소켓 해제 ────────────────────────────────────────────────
  const disconnectSocket = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current = null
    setIsConnected(false)
  }, [])

  // ── 초기화: 공연 조회 + 대기열 상태 확인 ─────────────────────
  useEffect(() => {
    if (!concertId) return

    const token = getToken()
    if (!token) {
      setPhase('no_auth')
      return
    }

    setPhase('loading')
    setConcertError(null)

    let cancelled = false

    async function init() {
      try {
        const concertData = await api.get<Concert>(`/api/concerts/${concertId}`)
        if (cancelled) return
        setConcert(concertData)

        // 이미 대기열에 있는지 확인
        try {
          const status = await api.get<QueueStatusResponse>(
            `/api/queue/${concertId}/status`,
          )
          if (cancelled) return

          if (status.status === 'WAITING') {
            setPosition(status.position ?? null)
            setTotal(status.total ?? null)
            setPhase('in_queue')
            // 이미 대기 중 → 소켓 연결해서 재접속 시도
            if (concertId) connectSocket(concertId)
          } else if (status.status === 'ADMITTED') {
            setPhase('admitted')
          } else {
            setPhase('idle')
          }
        } catch {
          // 상태 조회 실패 → idle로 폴백
          if (!cancelled) setPhase('idle')
        }
      } catch (err) {
        if (cancelled) return
        const msg = axios.isAxiosError(err)
          ? (err.response?.data?.message ?? err.message)
          : '공연 정보를 불러올 수 없습니다'
        setConcertError(msg)
        setPhase('concert_error')
      }
    }

    init()

    return () => {
      cancelled = true
      disconnectSocket()
    }
  }, [concertId, connectSocket, disconnectSocket])

  // ── beforeunload: 대기 중 탭 닫힘 감지 ───────────────────────
  useEffect(() => {
    function handleBeforeUnload() {
      if (phase === 'in_queue' && concertId) {
        sessionStorage.setItem(RECONNECT_KEY, concertId)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase, concertId])

  // ── 대기열 진입 ──────────────────────────────────────────────
  const enterQueue = useCallback(() => {
    if (!concertId) return

    const token = getToken()
    if (!token) {
      setPhase('no_auth')
      return
    }

    setPhase('entering')
    enteringRef.current = true
    // 소켓 connect 콜백에서 queue:enter 이벤트를 emit함
    connectSocket(concertId)
  }, [concertId, connectSocket])

  // ── 대기열 이탈 ──────────────────────────────────────────────
  const leaveQueue = useCallback(() => {
    if (!concertId) return

    const socket = socketRef.current
    if (socket?.connected) {
      // 소켓 이벤트로 이탈: 큐 제거 + 룸 leave가 원자적으로 처리됨
      socket.emit('queue:leave', { concertId })
    }

    sessionStorage.removeItem(RECONNECT_KEY)
    disconnectSocket()
    setPosition(null)
    setTotal(null)
    setPhase('idle')
  }, [concertId, disconnectSocket])

  const clearError = useCallback(() => setErrorMessage(null), [])

  return {
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
  }
}
