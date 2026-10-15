/**
 * Admin Authentication & Authorization Middleware using JWT.
 */
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'يتطلب الوصول تسجيل الدخول كمسؤول في الجامعة.'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'جلسة تسجيل الدخول منتهية أو غير صالحة. يرجى تسجيل الدخول مجددًا.'
    });
  }
}

export function requireSuperAdmin(req, res, next) {
  requireAdmin(req, res, () => {
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'عذرًا، هذه العملية تتطلب صلاحية مدير عام النظام.'
      });
    }
    next();
  });
}
