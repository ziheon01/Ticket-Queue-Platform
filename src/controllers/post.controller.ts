import { Request, Response } from 'express';
import { successResponse } from '../utils/response';
import { CreatePostDto } from '../dtos/post.dto';
import * as postService from '../services/post.service';

export async function createPostHandler(req: Request, res: Response): Promise<void> {
  const input = CreatePostDto.parse(req.body);
  const post = await postService.createPost(req.user!.id, input);
  res.status(201).json(successResponse(post));
}

export async function getMyPostsHandler(req: Request, res: Response): Promise<void> {
  const posts = await postService.getMyPosts(req.user!.id);
  res.status(200).json(successResponse(posts));
}

export async function getPostDetailHandler(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const post = await postService.getPostDetail(req.params.id, req.user!.id);
  res.status(200).json(successResponse(post));
}

export async function deletePostHandler(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  await postService.deletePost(req.params.id, req.user!.id);
  res.status(200).json(successResponse(null, '문의가 삭제되었습니다'));
}
