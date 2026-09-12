import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { validateBody, registerSchema, loginSchema } from '../validators/auth.validator.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), AuthController.register);
authRouter.post('/login', validateBody(loginSchema), AuthController.login);
authRouter.get('/me', requireAuth, AuthController.getMe);
authRouter.post('/logout', AuthController.logout);
