import { Request, Response } from 'express';
import { successResponse } from '../utils/response';
import { TossWebhookDto } from '../dtos/reservation.dto';
import { handleWebhook } from '../services/reservation.service';
import { AppError } from '../utils/errors';

export async function tossWebhookHandler(req: Request, res: Response): Promise<void> {
  const parsed = TossWebhookDto.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, '잘못된 Webhook 형식입니다');

  await handleWebhook(parsed.data);
  res.status(200).json(successResponse(null, 'Webhook 처리 완료'));
}
