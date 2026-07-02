import { prisma } from '../utils/prisma';
import type { CreatePostInput } from '../dtos/post.dto';

// ── Post ─────────────────────────────────────────────────

export async function createPost(userId: string, data: CreatePostInput) {
  return prisma.post.create({
    data: { userId, title: data.title, content: data.content },
  });
}

export async function findPostsByUser(userId: string) {
  return prisma.post.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, status: true, createdAt: true },
  });
}

export async function findPostById(id: string) {
  return prisma.post.findUnique({
    where: { id },
    include: {
      reply: {
        select: { id: true, content: true, createdAt: true },
      },
    },
  });
}

export async function deletePost(id: string) {
  return prisma.post.delete({ where: { id } });
}

// ── Admin: 전체 목록 ─────────────────────────────────────

export async function findAllPosts() {
  return prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      user: { select: { id: true, nickname: true } },
    },
  });
}

// ── Reply ────────────────────────────────────────────────

export async function createReply(postId: string, adminId: string, content: string) {
  return prisma.$transaction([
    prisma.reply.create({ data: { postId, adminId, content } }),
    prisma.post.update({ where: { id: postId }, data: { status: 'ANSWERED' } }),
  ]);
}

export async function findReplyByPostId(postId: string) {
  return prisma.reply.findUnique({ where: { postId } });
}

export async function updateReply(postId: string, content: string) {
  return prisma.reply.update({ where: { postId }, data: { content } });
}
