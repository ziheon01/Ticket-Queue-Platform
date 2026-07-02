import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware';
import {
  getAllPostsHandler,
  createReplyHandler,
  updateReplyHandler,
} from '../controllers/adminPost.controller';

const router = Router();

router.get('/', requireAuth, requireAdmin, getAllPostsHandler);
router.post('/:id/reply', requireAuth, requireAdmin, createReplyHandler);
router.patch('/:id/reply', requireAuth, requireAdmin, updateReplyHandler);

export default router;
