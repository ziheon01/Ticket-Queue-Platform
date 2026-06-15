import { findConcertById } from '../repositories/concert.repository';
import * as queueRepo from '../repositories/queue.repository';
import { io } from '../utils/socket';
import { AppError } from '../utils/errors';
import type { QueuePositionResult, QueueStatusResult } from '../dtos/queue.dto';

// ── 공통 유틸 ─────────────────────────────────────────────

async function getPositionResult(
  concertId: string,
  userId: string,
): Promise<QueuePositionResult> {
  const rank = await queueRepo.getWaitingRank(concertId, userId);
  const total = await queueRepo.getWaitingCount(concertId);
  return { position: (rank ?? 0) + 1, total };
}

/** 해당 공연 대기열 전체에 개인별 순번을 각각 push */
async function broadcastPositions(concertId: string): Promise<void> {
  if (!io) return;
  const sockets = await io.in(`concert:${concertId}`).fetchSockets();
  if (sockets.length === 0) return;

  // ZRANGE 한 번으로 전체 순위 맵 구성 (N+1 ZRANK 제거)
  const members = await queueRepo.getAllWaiting(concertId);
  const total = members.length;
  const rankMap = new Map(members.map((uid, idx) => [uid, idx]));

  for (const s of sockets) {
    const uid = s.data.userId as string | undefined;
    if (!uid) continue;
    const rank = rankMap.get(uid);
    if (rank !== undefined) {
      s.emit('queue:position', { position: rank + 1, total });
    }
  }
}

// ── HTTP / 서비스 API ─────────────────────────────────────

export async function enterQueue(
  concertId: string,
  userId: string,
): Promise<QueuePositionResult> {
  const concert = await findConcertById(concertId);
  if (!concert) throw new AppError(404, '공연을 찾을 수 없습니다');
  if (concert.status !== 'ON_SALE') throw new AppError(400, '현재 판매 중인 공연이 아닙니다');

  const alreadyIn = await queueRepo.isInWaiting(concertId, userId);
  if (alreadyIn) throw new AppError(409, '이미 대기열에 등록되어 있습니다');

  const admitted = await queueRepo.isAdmitted(concertId, userId);
  if (admitted) throw new AppError(409, '이미 입장한 상태입니다');

  await queueRepo.addToWaiting(concertId, userId);
  return getPositionResult(concertId, userId);
}

export async function leaveQueue(concertId: string, userId: string): Promise<void> {
  const inQueue = await queueRepo.isInWaiting(concertId, userId);
  if (!inQueue) throw new AppError(404, '대기열에 없는 유저입니다');

  await queueRepo.removeFromWaiting(concertId, userId);
}

export async function getQueueStatus(
  concertId: string,
  userId: string,
): Promise<QueueStatusResult> {
  if (await queueRepo.isAdmitted(concertId, userId)) {
    return { status: 'ADMITTED' };
  }

  const rank = await queueRepo.getWaitingRank(concertId, userId);
  if (rank === null) {
    return { status: 'NOT_IN_QUEUE' };
  }

  const total = await queueRepo.getWaitingCount(concertId);
  return { status: 'WAITING', position: rank + 1, total };
}

// ── WebSocket 흐름 ─────────────────────────────────────────

/** Socket disconnect 시: reconnect 유예 키 설정 */
export async function handleDisconnect(concertId: string, userId: string): Promise<void> {
  const inQueue = await queueRepo.isInWaiting(concertId, userId);
  if (!inQueue) return;
  await queueRepo.setReconnectKey(concertId, userId);
}

/** queue:reconnect 이벤트: 유예 키 존재하면 복원, 없으면 에러 */
export async function handleReconnect(
  concertId: string,
  userId: string,
): Promise<QueuePositionResult> {
  const hasKey = await queueRepo.hasReconnectKey(concertId, userId);
  if (!hasKey) throw new AppError(400, '재연결 유예 시간이 만료되었습니다');

  await queueRepo.deleteReconnectKey(concertId, userId);
  return getPositionResult(concertId, userId);
}

/** BullMQ disconnect job 실행: 유예 키 없으면 대기열에서 제거 */
export async function expireDisconnect(concertId: string, userId: string): Promise<void> {
  const stillAlive = await queueRepo.hasReconnectKey(concertId, userId);
  if (stillAlive) return; // 재접속됨 — 아무것도 안 함

  await queueRepo.removeFromWaiting(concertId, userId);
  await broadcastPositions(concertId);
}

/** BullMQ admission job: 대기열 상단 1명 입장 처리 */
export async function admitNextUser(concertId: string): Promise<void> {
  const admittedCount = await queueRepo.countAdmitted(concertId);
  if (admittedCount > 0) return; // 아직 입장 중인 유저 있음

  const top = await queueRepo.getTopWaiting(concertId, 1);
  if (top.length === 0) return;

  const userId = top[0];
  await queueRepo.removeFromWaiting(concertId, userId);
  await queueRepo.setAdmittedKey(concertId, userId);

  // 입장 알림 → 개인 방
  io?.to(`user:${userId}`).emit('queue:admitted');

  // 남은 대기자 순번 업데이트
  await broadcastPositions(concertId);
}
