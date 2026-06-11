import { Request, Response } from 'express';
import { successResponse } from '../utils/response';
import { CreateReservationDto, toReservationDetailResponse } from '../dtos/reservation.dto';
import * as reservationService from '../services/reservation.service';

export async function createReservationHandler(req: Request, res: Response): Promise<void> {
  const input = CreateReservationDto.parse(req.body);
  const result = await reservationService.createReservation(req.user!.id, input);
  res.status(201).json(successResponse(result));
}

export async function getMyReservationsHandler(req: Request, res: Response): Promise<void> {
  const reservations = await reservationService.getMyReservations(req.user!.id);
  res.status(200).json(successResponse(reservations.map(toReservationDetailResponse)));
}

export async function getReservationDetailHandler(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const reservation = await reservationService.getReservationDetail(req.params.id, req.user!.id);
  res.status(200).json(successResponse(toReservationDetailResponse(reservation)));
}

export async function cancelReservationHandler(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  await reservationService.cancelReservation(req.params.id, req.user!.id);
  res.status(200).json(successResponse(null, '예매가 취소되었습니다'));
}

export async function extendReservationHandler(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const result = await reservationService.extendReservation(req.params.id, req.user!.id);
  res.status(200).json(successResponse(result));
}
