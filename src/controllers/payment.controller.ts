import { Request, Response } from 'express';
import { successResponse } from '../utils/response';
import { TossWebhookDto } from '../dtos/reservation.dto';
import { handleWebhook } from '../services/reservation.service';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';

export async function tossWebhookHandler(req: Request, res: Response): Promise<void> {
  logger.info({ body: req.body }, '[WEBHOOK] 수신됨');
  logger.info({ authorization: req.headers.authorization }, '[WEBHOOK] 인증 헤더');

  const parsed = TossWebhookDto.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues, body: req.body }, '[WEBHOOK] 형식 검증 실패');
    throw new AppError(400, '잘못된 Webhook 형식입니다');
  }

  try {
    await handleWebhook(parsed.data.data);
    logger.info('[WEBHOOK] 처리 완료');
    res.status(200).json(successResponse(null, 'Webhook 처리 완료'));
  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    }, '[WEBHOOK] 처리 실패 상세');
    throw error;
  }
}
