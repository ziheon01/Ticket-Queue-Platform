import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

export let io: Server | undefined;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });
  return io;
}
