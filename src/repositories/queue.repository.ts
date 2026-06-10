import { redis } from '../utils/redis';

// ── Key helpers ─────────────────────────────────────────
export const waitingKey = (concertId: string) => `queue:${concertId}:waiting`;
export const admittedKey = (concertId: string, userId: string) =>
  `queue:${concertId}:admitted:${userId}`;
export const reconnectKey = (concertId: string, userId: string) =>
  `queue:${concertId}:reconnect:${userId}`;

// ── Waiting Sorted Set ───────────────────────────────────
export async function addToWaiting(concertId: string, userId: string): Promise<void> {
  await redis.zadd(waitingKey(concertId), Date.now(), userId);
}

export async function removeFromWaiting(concertId: string, userId: string): Promise<void> {
  await redis.zrem(waitingKey(concertId), userId);
}

export async function getWaitingRank(concertId: string, userId: string): Promise<number | null> {
  return redis.zrank(waitingKey(concertId), userId); // 0-based, null if absent
}

export async function getWaitingCount(concertId: string): Promise<number> {
  return redis.zcard(waitingKey(concertId));
}

export async function isInWaiting(concertId: string, userId: string): Promise<boolean> {
  const rank = await redis.zrank(waitingKey(concertId), userId);
  return rank !== null;
}

export async function getTopWaiting(concertId: string, count: number): Promise<string[]> {
  return redis.zrange(waitingKey(concertId), 0, count - 1);
}

// ── Admitted ────────────────────────────────────────────
export async function setAdmittedKey(concertId: string, userId: string): Promise<void> {
  await redis.set(admittedKey(concertId, userId), '1', 'EX', 300); // 5 minutes
}

export async function deleteAdmittedKey(concertId: string, userId: string): Promise<void> {
  await redis.del(admittedKey(concertId, userId));
}

export async function isAdmitted(concertId: string, userId: string): Promise<boolean> {
  return (await redis.exists(admittedKey(concertId, userId))) === 1;
}

export async function countAdmitted(concertId: string): Promise<number> {
  const keys = await redis.keys(`queue:${concertId}:admitted:*`);
  return keys.length;
}

// ── Reconnect ────────────────────────────────────────────
export async function setReconnectKey(concertId: string, userId: string): Promise<void> {
  await redis.set(reconnectKey(concertId, userId), '1', 'EX', 30);
}

export async function deleteReconnectKey(concertId: string, userId: string): Promise<void> {
  await redis.del(reconnectKey(concertId, userId));
}

export async function hasReconnectKey(concertId: string, userId: string): Promise<boolean> {
  return (await redis.exists(reconnectKey(concertId, userId))) === 1;
}
