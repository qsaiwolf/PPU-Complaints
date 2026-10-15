/**
 * Rate limiting middleware to protect endpoints from abuse and brute-force attacks.
 */
import rateLimit from 'express-rate-limit';

// Standard limiter for general API requests (200 requests per 15 minutes)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'تم تجاوز الحد المسموح به من الطلبات مؤقتًا. يرجى الانتظار بضع دقائق ثم المحاولة مجددًا.'
  }
});

// Stricter limiter for complaint submission (20 complaints per hour per IP)
export const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'لقد أرسلت عدة شكاوى مؤخرًا. يرجى الانتظار قليلًا قبل إرسال شكوى جديدة.'
  }
});

// Strictest limiter for Admin Login to prevent password brute-force (10 attempts per 15 min)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'تم تجاوز محاولات تسجيل الدخول المسموحة. يرجى الانتظار 15 دقيقة.'
  }
});
