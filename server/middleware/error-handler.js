/**
 * Global Error Handler Middleware.
 * Catches all server errors and formats them into the standard JSON response envelope.
 */

export function errorHandler(err, req, res, next) {
  console.error(`❌ [Server Error] ${req.method} ${req.url}:`, err.message);

  // Multer file upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'حجم الصورة المرفقة يتجاوز الحد الأقصى المسموح به (5 ميجابايت).'
      });
    }
    return res.status(400).json({
      success: false,
      message: `خطأ في رفع الملف: ${err.message}`
    });
  }

  // Custom client errors
  const status = err.status || 500;
  const message = err.message || 'حدث خطأ غير متوقع في الخادم. يرجى المحاولة لاحقًا.';

  res.status(status).json({
    success: false,
    message: message
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'المسار المطلوب غير موجود في النظام.'
  });
}
