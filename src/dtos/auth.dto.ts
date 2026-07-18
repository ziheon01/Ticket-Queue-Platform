import { z } from 'zod';

export const RegisterDto = z.object({
  email: z.string().min(1, '이메일을 입력해주세요').email('유효한 이메일 형식이 아닙니다'),
  password: z.string().min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
  nickname: z.string().min(2, '닉네임은 최소 2자 이상이어야 합니다').max(20, '닉네임은 최대 20자까지 가능합니다'),
  role: z.enum(['ADMIN', 'USER']).optional().default('USER'),
});

export const LoginDto = z.object({
  email: z.string().min(1, '이메일을 입력해주세요').email('유효한 이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

export const RefreshDto = z.object({
  refreshToken: z.string().min(1, 'refreshToken을 입력해주세요'),
});

export const LogoutDto = z.object({
  refreshToken: z.string().min(1, 'refreshToken을 입력해주세요'),
});

export type RegisterInput = z.infer<typeof RegisterDto>;
export type LoginInput = z.infer<typeof LoginDto>;
