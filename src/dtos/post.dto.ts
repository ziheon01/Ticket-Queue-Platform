import { z } from 'zod';

// ── 요청 스키마 ──────────────────────────────────────────

export const CreatePostDto = z.object({
  title: z.string().min(1, '제목을 입력해주세요').max(200, '제목은 200자 이하로 입력해주세요'),
  content: z.string().min(1, '내용을 입력해주세요'),
});

export const CreateReplyDto = z.object({
  content: z.string().min(1, '답변 내용을 입력해주세요'),
});

export const UpdateReplyDto = z.object({
  content: z.string().min(1, '답변 내용을 입력해주세요'),
});

export type CreatePostInput = z.infer<typeof CreatePostDto>;
export type CreateReplyInput = z.infer<typeof CreateReplyDto>;
export type UpdateReplyInput = z.infer<typeof UpdateReplyDto>;

// ── 응답 타입 ────────────────────────────────────────────

export interface AdminPostSummaryResponse {
  id: string;
  title: string;
  content: string;
  status: string;
  createdAt: Date;
  userId: string;
  userNickname: string;
  reply: { id: string; content: string } | null;
}
