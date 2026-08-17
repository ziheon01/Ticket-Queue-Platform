import { Queue, Worker } from 'bullmq';
import { admitNextUser, expireDisconnect } from '../../services/queue.service';
import { findAllConcerts } from '../../repositories/concert.repository';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6380';
const url = new URL(redisUrl);

const connection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
  ...(url.password && { password: url.password }),
};

// ── 큐 정의 ─────────────────────────────────────────────

export const QUEUE_ADMISSION = 'queue-admission';
export const QUEUE_DISCONNECT = 'queue-disconnect';

export const admissionQueue = new Queue(QUEUE_ADMISSION, { connection });
export const disconnectQueue = new Queue(QUEUE_DISCONNECT, { connection });

// ── 입장 처리 Worker (5초 반복) ───────────────────────────

export function startQueueAdmissionWorker(): Worker {
  const worker = new Worker(
    QUEUE_ADMISSION,
    async () => {
      const concerts = await findAllConcerts('ON_SALE');
      for (const concert of concerts) {
        await admitNextUser(concert.id);
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[QueueAdmissionWorker] job ${job?.id} failed:`, err);
  });

  return worker;
}

export async function registerAdmissionCron(): Promise<void> {
  const existing = await admissionQueue.getRepeatableJobs();
  for (const job of existing) {
    await admissionQueue.removeRepeatableByKey(job.key);
  }

  await admissionQueue.add(
    'admit',
    {},
    {
      repeat: { every: 5_000 },
      removeOnComplete: 5,
      removeOnFail: 5,
    },
  );
}

// ── 연결 해제 처리 Worker (delayed job) ──────────────────

export function startQueueDisconnectWorker(): Worker {
  const worker = new Worker(
    QUEUE_DISCONNECT,
    async (job) => {
      const { concertId, userId } = job.data as { concertId: string; userId: string };
      await expireDisconnect(concertId, userId);
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[QueueDisconnectWorker] job ${job?.id} failed:`, err);
  });

  return worker;
}

export function scheduleDisconnectJob(concertId: string, userId: string): void {
  disconnectQueue
    .add('disconnect', { concertId, userId }, { delay: 30_000, removeOnComplete: 5 })
    .catch((err) => console.error('[QueueDisconnect] schedule failed:', err));
}
