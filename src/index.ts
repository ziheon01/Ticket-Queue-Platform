import 'dotenv/config';
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import 'express-async-errors';
import authRouter from './routes/auth.routes';
import adminRouter from './routes/admin.routes';
import concertRouter from './routes/concert.routes';
import queueRouter from './routes/queue.routes';
import reservationRouter from './routes/reservation.routes';
import paymentRouter from './routes/payment.routes';
import { errorHandler } from './middlewares/error.middleware';
import { registerConcertStatusCron } from './queues/concertStatus.queue';
import { startConcertStatusWorker } from './queues/workers/concertStatus.worker';
import { registerAdmissionCron, startQueueAdmissionWorker, startQueueDisconnectWorker } from './queues/workers/queue.worker';
import { startReservationExpiryWorker } from './queues/workers/reservation.worker';
import { initSocket } from './utils/socket';
import { registerQueueSocket } from './socket/queue.socket';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/concerts', concertRouter);
app.use('/api/queue', queueRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/payments', paymentRouter);

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT ?? 3001;
  const server = http.createServer(app);
  const io = initSocket(server);
  registerQueueSocket(io);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  registerConcertStatusCron().catch(console.error);
  startConcertStatusWorker();
  registerAdmissionCron().catch(console.error);
  startQueueAdmissionWorker();
  startQueueDisconnectWorker();
  startReservationExpiryWorker();
}

export default app;
