import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import 'express-async-errors';
import authRouter from './routes/auth.routes';
import adminRouter from './routes/admin.routes';
import concertRouter from './routes/concert.routes';
import { errorHandler } from './middlewares/error.middleware';
import { registerConcertStatusCron } from './queues/concertStatus.queue';
import { startConcertStatusWorker } from './queues/workers/concertStatus.worker';

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

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT ?? 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  registerConcertStatusCron().catch(console.error);
  startConcertStatusWorker();
}

export default app;
