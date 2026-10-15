/**
 * Secure file upload middleware using Multer.
 * Sanitizes filenames, enforces 5MB limit, and restricts to JPG/PNG images only.
 */
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from '../config/env.js';

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate secure randomized UUID filename to prevent path traversal
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `ppu-complaint-${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png'];

  if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('الملفات المسموح بها هي الصور فقط بصيغة JPG أو PNG.'));
  }
};

export const uploadAttachment = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter
}).single('image');
