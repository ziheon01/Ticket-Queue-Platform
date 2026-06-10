import { Request, Response } from 'express';
import {
  CreateConcertDto,
  UpdateConcertDto,
  CreateZoneDto,
  UpdateZoneDto,
} from '../dtos/concert.dto';
import {
  adminCreateConcert,
  adminUpdateConcert,
  adminDeleteConcert,
  getConcertStats,
  adminCreateZone,
  adminUpdateZone,
  adminDeleteZone,
} from '../services/concert.service';
import { successResponse } from '../utils/response';

type IdParam = { id: string };

export async function createConcertHandler(req: Request, res: Response): Promise<void> {
  const input = CreateConcertDto.parse(req.body);
  const concert = await adminCreateConcert(input);
  res.status(201).json(successResponse(concert));
}

export async function updateConcertHandler(req: Request<IdParam>, res: Response): Promise<void> {
  const input = UpdateConcertDto.parse(req.body);
  const concert = await adminUpdateConcert(req.params.id, input);
  res.status(200).json(successResponse(concert));
}

export async function deleteConcertHandler(req: Request<IdParam>, res: Response): Promise<void> {
  await adminDeleteConcert(req.params.id);
  res.status(200).json(successResponse(null, '공연이 삭제되었습니다'));
}

export async function getConcertStatsHandler(req: Request<IdParam>, res: Response): Promise<void> {
  const stats = await getConcertStats(req.params.id);
  res.status(200).json(successResponse(stats));
}

export async function createZoneHandler(req: Request<IdParam>, res: Response): Promise<void> {
  const input = CreateZoneDto.parse(req.body);
  const zone = await adminCreateZone(req.params.id, input);
  res.status(201).json(successResponse(zone));
}

export async function updateZoneHandler(req: Request<IdParam>, res: Response): Promise<void> {
  const input = UpdateZoneDto.parse(req.body);
  const zone = await adminUpdateZone(req.params.id, input);
  res.status(200).json(successResponse(zone));
}

export async function deleteZoneHandler(req: Request<IdParam>, res: Response): Promise<void> {
  await adminDeleteZone(req.params.id);
  res.status(200).json(successResponse(null, '구역이 삭제되었습니다'));
}
