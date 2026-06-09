import { createHash } from 'crypto';
import { prisma } from '../utils/prisma';
import { RefreshToken } from '../generated/prisma';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createRefreshToken(
  userId: string,
  token: string,
  expiresAt: Date,
): Promise<RefreshToken> {
  return prisma.refreshToken.create({
    data: { userId, token: hashToken(token), expiresAt },
  });
}

export async function findRefreshTokenByRaw(token: string): Promise<RefreshToken | null> {
  return prisma.refreshToken.findUnique({ where: { token: hashToken(token) } });
}

export async function deleteRefreshTokenByRaw(token: string): Promise<void> {
  await prisma.refreshToken.delete({ where: { token: hashToken(token) } });
}
