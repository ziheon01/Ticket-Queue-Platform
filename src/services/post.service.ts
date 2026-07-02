import { AppError } from '../utils/errors';
import * as postRepo from '../repositories/post.repository';
import type { CreatePostInput, CreateReplyInput, UpdateReplyInput } from '../dtos/post.dto';

// ── 유저 ─────────────────────────────────────────────────

export async function createPost(userId: string, input: CreatePostInput) {
  return postRepo.createPost(userId, input);
}

export async function getMyPosts(userId: string) {
  return postRepo.findPostsByUser(userId);
}

export async function getPostDetail(postId: string, userId: string) {
  const post = await postRepo.findPostById(postId);
  if (!post) throw new AppError(404, '존재하지 않는 문의입니다');
  if (post.userId !== userId) throw new AppError(403, '본인의 문의만 조회할 수 있습니다');
  return post;
}

export async function deletePost(postId: string, userId: string) {
  const post = await postRepo.findPostById(postId);
  if (!post) throw new AppError(404, '존재하지 않는 문의입니다');
  if (post.userId !== userId) throw new AppError(403, '본인의 문의만 삭제할 수 있습니다');
  if (post.status !== 'PENDING') throw new AppError(400, '답변이 등록된 문의는 삭제할 수 없습니다');
  return postRepo.deletePost(postId);
}

// ── 어드민 ────────────────────────────────────────────────

export async function getAllPosts() {
  return postRepo.findAllPosts();
}

export async function createReply(postId: string, adminId: string, input: CreateReplyInput) {
  const post = await postRepo.findPostById(postId);
  if (!post) throw new AppError(404, '존재하지 않는 문의입니다');

  const existing = await postRepo.findReplyByPostId(postId);
  if (existing) throw new AppError(409, '이미 답변이 등록된 문의입니다');

  const [reply] = await postRepo.createReply(postId, adminId, input.content);
  return reply;
}

export async function updateReply(postId: string, input: UpdateReplyInput) {
  const post = await postRepo.findPostById(postId);
  if (!post) throw new AppError(404, '존재하지 않는 문의입니다');

  const existing = await postRepo.findReplyByPostId(postId);
  if (!existing) throw new AppError(404, '등록된 답변이 없습니다');

  return postRepo.updateReply(postId, input.content);
}
