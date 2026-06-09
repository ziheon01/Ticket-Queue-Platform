import { Role, User } from '../generated/prisma';
import { RegisterInput, LoginInput } from '../dtos/auth.dto';
import { findUserByEmail, findUserById, createUser } from '../repositories/user.repository';
import {
  createRefreshToken,
  findRefreshTokenByRaw,
  deleteRefreshTokenByRaw,
} from '../repositories/refreshToken.repository';
import { hashPassword, comparePassword } from '../utils/bcrypt';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AppError } from '../utils/errors';

export interface UserDto {
  id: string;
  email: string;
  nickname: string;
  role: string;
  createdAt: Date;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function refreshExpiresAt(): Date {
  const days = parseInt(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d', 10) || 7;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export async function register(input: RegisterInput): Promise<UserDto> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw new AppError(409, '이미 사용 중인 이메일입니다');
  }

  const hashed = await hashPassword(input.password);
  const user = await createUser({
    email: input.email,
    password: hashed,
    nickname: input.nickname,
    role: (input.role ?? 'USER') as Role,
  });

  return toUserDto(user);
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new AppError(401, '이메일 또는 비밀번호가 올바르지 않습니다');
  }

  const isMatch = await comparePassword(input.password, user.password);
  if (!isMatch) {
    throw new AppError(401, '이메일 또는 비밀번호가 올바르지 않습니다');
  }

  const accessToken = signAccessToken(user.id, user.email, user.role);
  const refreshToken = signRefreshToken(user.id, user.email, user.role);
  await createRefreshToken(user.id, refreshToken, refreshExpiresAt());

  return { accessToken, refreshToken, user: toUserDto(user) };
}

export async function logout(rawToken: string): Promise<void> {
  const stored = await findRefreshTokenByRaw(rawToken);
  if (!stored) {
    throw new AppError(401, '유효하지 않은 토큰입니다');
  }
  await deleteRefreshTokenByRaw(rawToken);
}

export async function refresh(rawToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  // 1. JWT 서명 검증
  let payload;
  try {
    payload = verifyRefreshToken(rawToken);
  } catch {
    throw new AppError(401, '유효하지 않은 토큰입니다');
  }

  // 2. DB에 존재하는지 확인 (로그아웃·재사용 방지)
  const stored = await findRefreshTokenByRaw(rawToken);
  if (!stored) {
    throw new AppError(401, '유효하지 않은 토큰입니다');
  }

  // 3. 만료 여부 확인
  if (stored.expiresAt < new Date()) {
    await deleteRefreshTokenByRaw(rawToken);
    throw new AppError(401, '만료된 토큰입니다');
  }

  // 4. 로테이션: 구 토큰 삭제 → 새 토큰 발급
  await deleteRefreshTokenByRaw(rawToken);

  const newAccessToken = signAccessToken(payload.sub, payload.email, payload.role);
  const newRefreshToken = signRefreshToken(payload.sub, payload.email, payload.role);
  await createRefreshToken(payload.sub, newRefreshToken, refreshExpiresAt());

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function getMe(userId: string): Promise<UserDto> {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError(401, '사용자를 찾을 수 없습니다');
  }
  return toUserDto(user);
}
