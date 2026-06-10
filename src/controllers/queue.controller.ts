import { Request, Response } from 'express';
import { enterQueue, leaveQueue, getQueueStatus } from '../services/queue.service';
import { successResponse } from '../utils/response';

type ConcertParam = { concertId: string };

export async function enterQueueHandler(
  req: Request<ConcertParam>,
  res: Response,
): Promise<void> {
  const result = await enterQueue(req.params.concertId, req.user!.id);
  res.status(200).json(successResponse(result));
}

export async function leaveQueueHandler(
  req: Request<ConcertParam>,
  res: Response,
): Promise<void> {
  await leaveQueue(req.params.concertId, req.user!.id);
  res.status(200).json(successResponse(null, '대기열에서 이탈했습니다'));
}

export async function getQueueStatusHandler(
  req: Request<ConcertParam>,
  res: Response,
): Promise<void> {
  const result = await getQueueStatus(req.params.concertId, req.user!.id);
  res.status(200).json(successResponse(result));
}
