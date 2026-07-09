import { AppError } from '../utils/errors';
import { isAdmitted, deleteAdmittedKey } from '../repositories/queue.repository';
import * as reservationRepo from '../repositories/reservation.repository';
import type { CreateReservationInput, TossWebhookBody } from '../dtos/reservation.dto';
import { addReservationExpiryJob, removeReservationExpiryJob } from '../queues/workers/reservation.worker';
import { io } from '../utils/socket';

const LOCK_TTL = 300; // 5분
const EXTEND_TTL = 300; // 연장 시 5분
const EXTEND_THRESHOLD = 60; // 연장 가능 잔여 시간 기준 (1분 이하)

export async function createReservation(userId: string, input: CreateReservationInput) {
  const zone = await reservationRepo.findZoneById(input.concertZoneId);
  if (!zone) throw new AppError(404, '존재하지 않는 구역입니다');

  const admitted = await isAdmitted(zone.concertId, userId);
  if (!admitted) throw new AppError(403, '입장 권한이 없습니다. 대기열을 통해 입장해주세요');

  const totalPrice = zone.price * input.quantity;

  // DB에 reservation 레코드 먼저 생성 (Lua 스크립트에서 reservationId 필요)
  const reservation = await reservationRepo.createReservation(userId, input, totalPrice);

  // Lua 스크립트: 재고 확인 + 차감 + lock 설정 원자 처리
  const result = await reservationRepo.preemptStock(
    input.concertZoneId,
    userId,
    input.quantity,
    LOCK_TTL,
    reservation.id,
  );

  if (result === -1) {
    // 재고 부족 → DB 롤백 + admitted 키 삭제 (입장 슬롯 소진)
    await reservationRepo.updateReservationStatus(reservation.id, 'CANCELLED');
    await deleteAdmittedKey(zone.concertId, userId);
    throw new AppError(409, '해당 구역의 재고가 부족합니다');
  }

  if (result === -2) {
    // 이미 선점 중 → DB 롤백 + admitted 키 삭제 (입장 슬롯 소진)
    await reservationRepo.updateReservationStatus(reservation.id, 'CANCELLED');
    await deleteAdmittedKey(zone.concertId, userId);
    throw new AppError(409, '이미 진행 중인 예매가 있습니다');
  }

  // 결제 레코드 생성
  await reservationRepo.createPayment(reservation.id, totalPrice);

  // admitted 키 삭제 (이중 예매 방지)
  await deleteAdmittedKey(zone.concertId, userId);

  // BullMQ 만료 delayed job 등록 (5분)
  await addReservationExpiryJob({
    reservationId: reservation.id,
    concertZoneId: input.concertZoneId,
    userId,
    concertId: zone.concertId,
    quantity: input.quantity,
  });

  return { reservationId: reservation.id, totalPrice, remainSeconds: LOCK_TTL };
}

export async function getMyReservations(userId: string) {
  return reservationRepo.findReservationsByUser(userId);
}

export async function getReservationDetail(reservationId: string, requesterId: string) {
  const reservation = await reservationRepo.findReservationById(reservationId);
  if (!reservation) throw new AppError(404, '예매를 찾을 수 없습니다');
  if (reservation.userId !== requesterId) throw new AppError(403, '접근 권한이 없습니다');
  return reservation;
}

export async function cancelReservation(reservationId: string, requesterId: string) {
  const reservation = await reservationRepo.findReservationById(reservationId);
  if (!reservation) throw new AppError(404, '예매를 찾을 수 없습니다');
  if (reservation.userId !== requesterId) throw new AppError(403, '접근 권한이 없습니다');
  if (reservation.status !== 'PENDING') throw new AppError(400, '결제 대기 중인 예매만 취소할 수 있습니다');

  // Redis 선점 해제 + 재고 복구
  await reservationRepo.releaseStock(
    reservation.concertZoneId,
    requesterId,
    reservation.quantity,
  );

  // BullMQ 만료 job 취소
  await removeReservationExpiryJob(reservationId);

  // DB 상태 업데이트
  await reservationRepo.updateReservationStatus(reservationId, 'CANCELLED');
  await reservationRepo.updatePaymentStatus(reservationId, 'CANCELLED');
}

export async function extendReservation(reservationId: string, requesterId: string) {
  const reservation = await reservationRepo.findReservationById(reservationId);
  if (!reservation) throw new AppError(404, '예매를 찾을 수 없습니다');
  if (reservation.userId !== requesterId) throw new AppError(403, '접근 권한이 없습니다');
  if (reservation.status !== 'PENDING') throw new AppError(400, '결제 대기 중인 예매가 아닙니다');
  if (reservation.extendedAt) throw new AppError(409, '이미 결제 시간을 연장하셨습니다');

  const ttl = await reservationRepo.getLockTtl(reservation.concertZoneId, requesterId);
  if (ttl < 0) throw new AppError(400, '선점이 이미 만료되었습니다');
  if (ttl > EXTEND_THRESHOLD) throw new AppError(400, `결제 시간이 ${ttl}초 남았습니다. 1분 이하일 때만 연장 가능합니다`);

  // Redis lock TTL 연장
  await reservationRepo.extendLock(reservation.concertZoneId, requesterId, EXTEND_TTL);

  // BullMQ job 교체 (기존 제거 → 새 delayed job 등록)
  await removeReservationExpiryJob(reservationId);
  await addReservationExpiryJob({
    reservationId: reservation.id,
    concertZoneId: reservation.concertZoneId,
    userId: requesterId,
    concertId: reservation.concertZone.concertId,
    quantity: reservation.quantity,
  });

  // extendedAt 기록
  await reservationRepo.updateReservationStatus(reservationId, 'PENDING', new Date());

  // WebSocket: 연장된 타이머 전송
  io?.to(`user:${requesterId}`).emit('queue:extended', { remainSeconds: EXTEND_TTL });

  return { remainSeconds: EXTEND_TTL };
}

export async function handleWebhook(body: TossWebhookBody) {
  const reservationId = body.orderId;
  const reservation = await reservationRepo.findReservationById(reservationId);
  if (!reservation) throw new AppError(404, '예매를 찾을 수 없습니다');

  // 이미 최종 상태인 경우 멱등성 보장 (재시도 Webhook 중복 처리 방지)
  if (reservation.status !== 'PENDING') return;

  if (body.status === 'DONE') {
    await reservationRepo.updateReservationAndPaymentInTx(
      reservationId,
      'CONFIRMED',
      'DONE',
      body.paymentKey,
      new Date(),
    );

    // DB remainQuantity 차감 (Redis와 이중 관리: DB 최종 확정값 반영)
    await reservationRepo.decrementZoneRemainQuantity(
      reservation.concertZoneId,
      reservation.quantity,
    );

    // Redis lock 해제 (재고는 차감된 상태 유지)
    await reservationRepo.deleteLock(reservation.concertZoneId, reservation.userId);

    // BullMQ 만료 job 취소
    await removeReservationExpiryJob(reservationId);
  } else if (body.status === 'CANCELLED' || body.status === 'FAILED' || body.status === 'EXPIRED') {
    const reservationStatus = body.status === 'EXPIRED' ? 'EXPIRED' : 'CANCELLED';
    const paymentStatus = body.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED';
    await reservationRepo.updateReservationAndPaymentInTx(
      reservationId,
      reservationStatus,
      paymentStatus,
    );

    // 재고 복구
    await reservationRepo.releaseStock(
      reservation.concertZoneId,
      reservation.userId,
      reservation.quantity,
    );

    await removeReservationExpiryJob(reservationId);
  }
}
