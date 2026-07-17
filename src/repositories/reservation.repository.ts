import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';
import type { CreateReservationInput } from '../dtos/reservation.dto';

// ── Redis Key helpers ────────────────────────────────────

export const stockKey = (zoneId: string) => `zone:${zoneId}:stock`;
export const lockKey = (zoneId: string, userId: string) => `zone:${zoneId}:lock:${userId}`;

// ── Lua script: 재고 복구 + lock 삭제 원자 처리 ─────────────
const RELEASE_SCRIPT = `
redis.call('INCRBY', KEYS[1], tonumber(ARGV[1]))
redis.call('DEL', KEYS[2])
return 1
`;

// ── Lua script: 재고 확인 + 차감 + lock 설정 원자 처리 ──────
// Returns: 1=성공, -1=재고부족, -2=이미선점중
const PREEMPT_SCRIPT = `
local stock = tonumber(redis.call('GET', KEYS[1]))
if stock == nil then
  return -1
end
if stock < tonumber(ARGV[1]) then
  return -1
end
if redis.call('EXISTS', KEYS[2]) == 1 then
  return -2
end
redis.call('DECRBY', KEYS[1], tonumber(ARGV[1]))
redis.call('SET', KEYS[2], ARGV[3], 'EX', tonumber(ARGV[2]))
return 1
`;

// ── Redis stock / lock ───────────────────────────────────

export async function preemptStock(
  zoneId: string,
  userId: string,
  quantity: number,
  ttlSeconds: number,
  reservationId: string,
): Promise<number> {
  const result = await redis.eval(
    PREEMPT_SCRIPT,
    2,
    stockKey(zoneId),
    lockKey(zoneId, userId),
    String(quantity),
    String(ttlSeconds),
    reservationId,
  );
  return result as number;
}

export async function releaseStock(
  zoneId: string,
  userId: string,
  quantity: number,
): Promise<void> {
  await redis.eval(
    RELEASE_SCRIPT,
    2,
    stockKey(zoneId),
    lockKey(zoneId, userId),
    String(quantity),
  );
}

export async function deleteLock(zoneId: string, userId: string): Promise<void> {
  await redis.del(lockKey(zoneId, userId));
}

export async function getLockTtl(zoneId: string, userId: string): Promise<number> {
  return redis.ttl(lockKey(zoneId, userId));
}

export async function extendLock(
  zoneId: string,
  userId: string,
  ttlSeconds: number,
): Promise<void> {
  await redis.expire(lockKey(zoneId, userId), ttlSeconds);
}

// ── ConcertZone ──────────────────────────────────────────

export async function findZoneById(zoneId: string) {
  return prisma.concertZone.findUnique({
    where: { id: zoneId },
    include: { concert: true },
  });
}

export async function decrementZoneRemainQuantity(zoneId: string, quantity: number): Promise<void> {
  await prisma.concertZone.update({
    where: { id: zoneId },
    data: { remainQuantity: { decrement: quantity } },
  });
}

// ── Reservation ──────────────────────────────────────────

export async function createReservation(
  userId: string,
  input: CreateReservationInput,
  totalPrice: number,
) {
  return prisma.reservation.create({
    data: {
      userId,
      concertZoneId: input.concertZoneId,
      quantity: input.quantity,
      totalPrice,
      status: 'PENDING',
    },
  });
}

export async function findReservationById(id: string) {
  return prisma.reservation.findUnique({
    where: { id },
    include: {
      concertZone: {
        include: { concert: true },
      },
      payment: true,
    },
  });
}

export async function findReservationsByUser(userId: string) {
  return prisma.reservation.findMany({
    where: { userId },
    include: {
      concertZone: {
        include: { concert: true },
      },
      payment: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateReservationStatus(
  id: string,
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED',
  extendedAt?: Date,
) {
  return prisma.reservation.update({
    where: { id },
    data: {
      status,
      ...(extendedAt && { extendedAt }),
    },
  });
}

// ── Payment ──────────────────────────────────────────────

export async function createPayment(reservationId: string, amount: number) {
  return prisma.payment.create({
    data: {
      reservationId,
      amount,
      status: 'READY',
    },
  });
}

export async function updatePaymentStatus(
  reservationId: string,
  status: 'READY' | 'DONE' | 'CANCELLED' | 'FAILED',
  paymentKey?: string,
  paidAt?: Date,
) {
  return prisma.payment.update({
    where: { reservationId },
    data: {
      status,
      ...(paymentKey && { paymentKey }),
      ...(paidAt && { paidAt }),
    },
  });
}

export async function updateReservationAndPaymentInTx(
  reservationId: string,
  reservationStatus: 'CONFIRMED' | 'CANCELLED' | 'EXPIRED',
  paymentStatus: 'DONE' | 'CANCELLED' | 'FAILED',
  paymentKey?: string,
  paidAt?: Date,
) {
  return prisma.$transaction([
    prisma.reservation.update({
      where: { id: reservationId },
      data: { status: reservationStatus },
    }),
    prisma.payment.update({
      where: { reservationId },
      data: {
        status: paymentStatus,
        ...(paymentKey && { paymentKey }),
        ...(paidAt && { paidAt }),
      },
    }),
  ]);
}
