/**
 * Central API Router (/api/v1)
 */
import express from 'express';
import { listServices } from '../controllers/services.js';
import { createComplaint, getComplaintById, listComplaints } from '../controllers/complaints.js';
import { saveRating, getRating } from '../controllers/ratings.js';
import { login, getMe, updateComplaint, addInternalNote, getStats, exportCsv, getCannedReplies, sendCannedNotification, getSmtpStatus } from '../controllers/admin.js';
import { requireAdmin } from '../middleware/auth.js';
import { uploadAttachment } from '../middleware/upload.js';
import { authLimiter, submitLimiter } from '../middleware/rate-limiter.js';
import { config } from '../config/env.js';

const router = express.Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    storageEngine: config.storageEngine,
    time: new Date().toISOString()
  });
});

// Services
router.get('/services', listServices);

// Complaints (Public / Student)
router.post('/complaints', submitLimiter, uploadAttachment, createComplaint);
router.get('/complaints/:id', getComplaintById);
router.get('/complaints', listComplaints);

// Ratings (Public / Student)
router.post('/complaints/:id/rating', saveRating);
router.get('/complaints/:id/rating', getRating);

// Admin Authentication
router.post('/auth/login', authLimiter, login);
router.get('/auth/me', requireAdmin, getMe);

// Admin Management
router.patch('/admin/complaints/:id', requireAdmin, updateComplaint);
router.post('/admin/complaints/:id/notes', requireAdmin, addInternalNote);
router.get('/admin/stats', requireAdmin, getStats);
router.get('/admin/export', requireAdmin, exportCsv);

// Admin Canned Replies & Notifications (Email & WhatsApp)
router.get('/admin/canned-replies', getCannedReplies);
router.post('/admin/canned-replies/send', requireAdmin, sendCannedNotification);
router.get('/admin/smtp/status', requireAdmin, getSmtpStatus);

export default router;

