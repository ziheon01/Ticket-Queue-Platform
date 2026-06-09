import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { errorResponse } from '../utils/response';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message));
    return;
  }

  if (err instanceof ZodError) {
    const message = err.issues.map((i) => i.message).join(', ');
    res.status(400).json(errorResponse(message));
    return;
  }

  console.error(err);
  res.status(500).json(errorResponse('서버 오류가 발생했습니다'));
}
