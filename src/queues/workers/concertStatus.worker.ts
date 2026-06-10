import { Worker } from 'bullmq';
import { tickConcertStatus } from '../../services/concert.service';
import { CONCERT_STATUS_QUEUE } from '../concertStatus.queue';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6380';
const url = new URL(redisUrl);

const connection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
  ...(url.password && { password: url.password }),
};

export function startConcertStatusWorker(): Worker {
  const worker = new Worker(
    CONCERT_STATUS_QUEUE,
    async () => {
      const count = await tickConcertStatus();
      if (count > 0) {
        console.log(`[ConcertStatusWorker] ${count}개 공연을 ON_SALE로 전환`);
      }
    },
    { connection },
  );

  worker.on('failed', (job, err) => {
    console.error(`[ConcertStatusWorker] job ${job?.id} failed:`, err);
  });

  return worker;
}
