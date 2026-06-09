import { Request, Response } from 'express';
import { RegisterDto, LoginDto, RefreshDto, LogoutDto } from '../dtos/auth.dto';
import { register, login, logout, refresh, getMe } from '../services/auth.service';
import { successResponse } from '../utils/response';

export async function registerHandler(req: Request, res: Response): Promise<void> {
  const input = RegisterDto.parse(req.body);
  const user = await register(input);
  res.status(201).json(successResponse(user));
}

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const input = LoginDto.parse(req.body);
  const result = await login(input);
  res.status(200).json(successResponse(result));
}

export async function logoutHandler(req: Request, res: Response): Promise<void> {
  const { refreshToken } = LogoutDto.parse(req.body);
  await logout(refreshToken);
  res.status(200).json(successResponse(null, '로그아웃되었습니다'));
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const { refreshToken } = RefreshDto.parse(req.body);
  const tokens = await refresh(refreshToken);
  res.status(200).json(successResponse(tokens));
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const user = await getMe(req.user!.id);
  res.status(200).json(successResponse(user));
}
