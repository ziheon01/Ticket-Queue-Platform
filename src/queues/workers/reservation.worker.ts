import { Queue, Worker } from 'bullmq';
import { releaseStock, updateReservationStatus, updatePaymentStatus, findReservationById } from '../../repositories/reservation.repository';
import { admitNextUser } from '../../services/queue.service';
import { io } from '../../utils/socket';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6380';
const url = new URL(redisUrl);

const connection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
  ...(url.password && { password: url.password }),
};

export const QUEUE_RESERVATION_EXPIRY = 'reservation-expiry';

export const expiryQueue = new Queue(QUEUE_RESERVATION_EXPIRY, { connection });

export interface ReservationExpiryPayload {
  reservationId: string;
  concertZoneId: string;
  userId: string;
  concertId: string;
  quantity: number;
}

export async function addReservationExpiryJob(payload: ReservationExpiryPayload): Promise<void> {
  await expiryQueue.add('expire', payload, {
    jobId: `expiry_${payload.reservationId}`,
    delay: 300_000, // 5분
    removeOnComplete: 5,
    removeOnFail: 5,
  });
}

export async function removeReservationExpiryJob(reservationId: string): Promise<void> {
  const job = await expiryQueue.getJob(`expiry_${reservationId}`);
  if (job) await job.remove();
}

export function startReservationExpiryWorker(): Worker {
  const worker = new Worker(
    QUEUE_RESERVATION_EXPIRY,
    async (job) => {
      const { reservationId, concertZoneId, userId, concertId, quantity } =
        job.data as ReservationExpiryPayload;

      const reservation = await findReservationById(reservationId);
      if (!reservation || reservation.status !== 'PENDING') return;

      // DB 상태 업데이트
      await updateReservationStatus(reservationId, 'EXPIRED');
      await updatePaymentStatus(reservationId, 'FAILED');

      // Redis 재고 복구
      await releaseStock(concertZoneId, userId, quantity);

      // 다음 대기자 입장 처리
      await admitNextUser(concertId);

      // WebSocket: 만료 알림
      io?.to(`user:${userId}`).emit('queue:expired');
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[ReservationExpiryWorker] job ${job?.id} failed:`, err);
  });

  return worker;
}
