/**
 * Environment configuration loader and validator.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Load .env from project root
dotenv.config({ path: path.join(rootDir, '.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.SERVER_PORT || process.env.PORT || 8080),
  storageEngine: (process.env.STORAGE_ENGINE || 'sqlite').toLowerCase(),
  
  // SQLite settings
  sqlitePath: path.resolve(rootDir, process.env.SQLITE_DB_PATH || './data/ppu_complaints.db'),
  
  // MySQL settings
  mysql: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ppu_complaints',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10)
  },
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'ppu_complaints_super_secret_jwt_key_2026_palestine',
  
  // Default Admin Credentials
  defaultAdmin: {
    name: process.env.ADMIN_DEFAULT_NAME || 'مسؤول النظام الجامعي',
    email: process.env.ADMIN_DEFAULT_EMAIL || 'admin@ppu.edu.ps',
    password: process.env.ADMIN_DEFAULT_PASSWORD || 'adminPPU2026!'
  },
  
  // Uploads
  uploadDir: path.resolve(rootDir, process.env.UPLOAD_DIR || './uploads'),
  maxFileSize: 5 * 1024 * 1024, // 5MB
  
  // Base Application URL
  appUrl: process.env.APP_URL || `http://localhost:${process.env.SERVER_PORT || process.env.PORT || 8080}`,

  // Email & SMTP settings
  enableEmailLog: process.env.ENABLE_EMAIL_CONSOLE_LOG !== 'false',
  smtp: {
    enabled: process.env.ENABLE_SMTP === 'true',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '"نظام الشكاوى - جامعة بوليتكنك فلسطين" <complaints@ppu.edu.ps>',
    replyTo: process.env.SMTP_REPLY_TO || 'complaints@ppu.edu.ps'
  },
  
  rootDir
};

