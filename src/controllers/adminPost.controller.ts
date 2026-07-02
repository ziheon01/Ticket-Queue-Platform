import { Request, Response } from 'express';
import { successResponse } from '../utils/response';
import { CreateReplyDto, UpdateReplyDto } from '../dtos/post.dto';
import type { AdminPostSummaryResponse } from '../dtos/post.dto';
import * as postService from '../services/post.service';

export async function getAllPostsHandler(req: Request, res: Response): Promise<void> {
  const posts = await postService.getAllPosts();
  const data: AdminPostSummaryResponse[] = posts.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    createdAt: p.createdAt,
    userId: p.user.id,
    userNickname: p.user.nickname,
  }));
  res.status(200).json(successResponse(data));
}

export async function createReplyHandler(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const input = CreateReplyDto.parse(req.body);
  const reply = await postService.createReply(req.params.id, req.user!.id, input);
  res.status(201).json(successResponse(reply));
}

export async function updateReplyHandler(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const input = UpdateReplyDto.parse(req.body);
  const reply = await postService.updateReply(req.params.id, input);
  res.status(200).json(successResponse(reply));
}
