/**
 * Express Application Setup.
 * Configures security, CORS, body parsers, static file serving, API routes, and error handling.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { config } from './config/env.js';
import apiRouter from './routes/api.js';
import { apiLimiter } from './middleware/rate-limiter.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Keep flexible for local font & icon loading
  crossOriginEmbedderPolicy: false
}));

// CORS middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limit on all API routes
app.use('/api', apiLimiter);

// Mount API v1
app.use('/api/v1', apiRouter);

// Serve uploads
app.use('/uploads', express.static(config.uploadDir));

// Serve static frontend assets
const rootDir = config.rootDir;
app.use(express.static(rootDir));

// SPA fallback for non-API GET requests (like /admin, /track)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    return res.sendFile(path.join(rootDir, 'index.html'));
  }
  next();
});

// 404 handler for unknown API routes
app.use('/api', notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
