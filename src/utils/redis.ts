import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6380';

export const redis = new Redis(redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: null,
});
