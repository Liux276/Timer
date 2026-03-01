import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { adminMiddleware, authMiddleware } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import backupRouter from './routes/backup.js';
import iterationsRouter from './routes/iterations.js';
import statsRouter from './routes/stats.js';
import tasksRouter from './routes/tasks.js';

const app = express();

// Respect reverse proxy headers (Caddy/Nginx) for correct client IP and rate-limit behavior.
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
}));

// Body parsing with size limit
app.use(express.json({ limit: '1mb' }));

// Global rate limit: 200 requests per minute
app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '请求过于频繁，请稍后再试' },
}));

// Stricter rate limit for setup/login endpoints: 10 per minute
const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '登录/注册请求过于频繁，请稍后再试' },
});

// setup-status should not share the strict login/setup bucket.
const setupStatusLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: '初始化状态请求过于频繁，请稍后再试' },
});

// Public auth routes
app.use('/api/auth/setup-status', setupStatusLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/setup', authLimiter);
app.use('/api/auth', authRouter);

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected routes (auth required)
app.use('/api/tasks', authMiddleware, tasksRouter);
app.use('/api/iterations', authMiddleware, iterationsRouter);
app.use('/api/stats', authMiddleware, statsRouter);
app.use('/api/backup', authMiddleware, adminMiddleware, backupRouter);

export default app;
