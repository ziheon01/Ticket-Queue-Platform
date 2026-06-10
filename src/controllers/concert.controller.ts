import { Request, Response } from 'express';
import { ConcertStatusQueryDto } from '../dtos/concert.dto';
import { listConcerts, getConcertDetail } from '../services/concert.service';
import { successResponse } from '../utils/response';
import { ConcertStatus } from '../generated/prisma';

type IdParam = { id: string };

export async function listConcertsHandler(req: Request, res: Response): Promise<void> {
  const { status } = ConcertStatusQueryDto.parse(req.query);
  const concerts = await listConcerts(status as ConcertStatus | undefined);
  res.status(200).json(successResponse(concerts));
}

export async function getConcertDetailHandler(req: Request<IdParam>, res: Response): Promise<void> {
  const concert = await getConcertDetail(req.params.id);
  res.status(200).json(successResponse(concert));
}
