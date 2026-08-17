import { prisma } from '../src/utils/prisma';
import { redis } from '../src/utils/redis';
import { concertStatusQueue } from '../src/queues/concertStatus.queue';
import { expiryQueue } from '../src/queues/workers/reservation.worker';
import { admissionQueue, disconnectQueue } from '../src/queues/workers/queue.worker';

/**
 * src/index.ts를 import하는 순간 BullMQ Queue들이 모듈 스코프에서 즉시 redis 커넥션을 맺는데,
 * 어떤 테스트 파일도 이를 닫지 않아 jest가 종료되지 않는 원인이었다.
 * 각 테스트 파일의 afterAll 마지막 줄에서 호출한다 (redis/prisma를 쓰는 자체 정리 로직보다 반드시 뒤에 와야 함).
 */
export async function closeTestConnections(): Promise<void> {
  await Promise.allSettled([
    concertStatusQueue.close(),
    expiryQueue.close(),
    admissionQueue.close(),
    disconnectQueue.close(),
  ]);
  if (redis.status !== 'end') {
    await redis.quit().catch(() => undefined);
  }
  await prisma.$disconnect();
}
