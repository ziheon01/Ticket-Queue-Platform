import type { Server, Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt';
import {
  enterQueue,
  leaveQueue,
  handleDisconnect,
  handleReconnect,
} from '../services/queue.service';
import { io } from '../utils/socket';

interface QueueEnterPayload {
  concertId: string;
}

async function broadcastPositions(concertId: string): Promise<void> {
  if (!io) return;
  const sockets = await io.in(`concert:${concertId}`).fetchSockets();
  if (sockets.length === 0) return;

  // ZRANGE 한 번으로 전체 순위 맵 구성 (N+1 ZRANK 제거)
  const { getAllWaiting } = await import('../repositories/queue.repository');
  const members = await getAllWaiting(concertId);
  const total = members.length;
  const rankMap = new Map(members.map((uid, idx) => [uid, idx]));

  for (const s of sockets) {
    const uid = s.data.userId as string | undefined;
    if (!uid) continue;
    const rank = rankMap.get(uid);
    if (rank !== undefined) {
      s.emit('queue:position', { position: rank + 1, total });
    }
  }
}

function authenticate(socket: Socket): { id: string; email: string; role: string } | null {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return null;
  try {
    const payload = verifyAccessToken(token);
    return { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

export function registerQueueSocket(server: Server): void {
  server.on('connection', (socket: Socket) => {
    const user = authenticate(socket);
    if (!user) {
      socket.disconnect(true);
      return;
    }

    // 개인 방 — 입장 알림 등 개인 메시지용
    socket.join(`user:${user.id}`);
    socket.data.userId = user.id;

    // ── queue:enter ────────────────────────────────────────
    socket.on('queue:enter', async (payload: QueueEnterPayload) => {
      const { concertId } = payload ?? {};
      if (!concertId) {
        socket.emit('queue:error', { message: 'concertId가 필요합니다' });
        return;
      }
      try {
        await enterQueue(concertId, user.id);
        socket.join(`concert:${concertId}`);
        socket.data.concertId = concertId;
        // 본인 포함 전체 대기자에게 순번 브로드캐스트
        await broadcastPositions(concertId);
      } catch (err) {
        socket.emit('queue:error', { message: (err as Error).message });
      }
    });

    // ── queue:leave ────────────────────────────────────────
    socket.on('queue:leave', async (payload: { concertId: string }) => {
      const concertId = payload?.concertId ?? (socket.data.concertId as string | undefined);
      if (!concertId) return;
      try {
        await leaveQueue(concertId, user.id);
        socket.leave(`concert:${concertId}`);
        socket.data.concertId = undefined;
        await broadcastPositions(concertId);
      } catch (err) {
        socket.emit('queue:error', { message: (err as Error).message });
      }
    });

    // ── queue:reconnect ────────────────────────────────────
    socket.on('queue:reconnect', async (payload: QueueEnterPayload) => {
      const { concertId } = payload ?? {};
      if (!concertId) {
        socket.emit('queue:error', { message: 'concertId가 필요합니다' });
        return;
      }
      try {
        const result = await handleReconnect(concertId, user.id);
        socket.join(`concert:${concertId}`);
        socket.data.concertId = concertId;
        socket.emit('queue:position', result);
      } catch (err) {
        socket.emit('queue:error', { message: (err as Error).message });
      }
    });

    // ── disconnect ─────────────────────────────────────────
    socket.on('disconnect', async () => {
      const concertId = socket.data.concertId as string | undefined;
      if (!concertId) return;
      await handleDisconnect(concertId, user.id);
      // BullMQ delayed job은 queue.worker에서 등록
      const { scheduleDisconnectJob } = await import('../queues/workers/queue.worker');
      scheduleDisconnectJob(concertId, user.id);
    });
  });
}
