import { Queue } from 'bullmq';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6380';
const url = new URL(redisUrl);

const connection = {
  host: url.hostname,
  port: Number(url.port) || 6379,
  ...(url.password && { password: url.password }),
};

export const CONCERT_STATUS_QUEUE = 'concert-status-queue';
export const CONCERT_STATUS_JOB = 'tick';

export const concertStatusQueue = new Queue(CONCERT_STATUS_QUEUE, { connection });

export async function registerConcertStatusCron(): Promise<void> {
  const repeatableJobs = await concertStatusQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await concertStatusQueue.removeRepeatableByKey(job.key);
  }

  await concertStatusQueue.add(
    CONCERT_STATUS_JOB,
    {},
    {
      repeat: { every: 60_000 },
      removeOnComplete: 10,
      removeOnFail: 5,
    },
  );
}
