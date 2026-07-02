import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  createPostHandler,
  getMyPostsHandler,
  getPostDetailHandler,
  deletePostHandler,
} from '../controllers/post.controller';

const router = Router();

router.post('/', requireAuth, createPostHandler);
router.get('/', requireAuth, getMyPostsHandler);
router.get('/:id', requireAuth, getPostDetailHandler);
router.delete('/:id', requireAuth, deletePostHandler);

export default router;
