/**
 * Ratings Controller
 * Handles student satisfaction ratings submitted after complaint resolution.
 */
import { getDatabaseAdapter } from '../database/connection.js';
import { RESOLUTION_TYPES } from '../config/constants.js';

export async function saveRating(req, res, next) {
  try {
    const rawId = req.params.id;
    const { stars, resolution, comment } = req.body;

    const parsedStars = Number(stars);
    if (!Number.isInteger(parsedStars) || parsedStars < 1 || parsedStars > 5) {
      return res.status(400).json({
        success: false,
        message: 'عدد النجوم يجب أن يكون رقمًا صحيحًا بين 1 و 5.'
      });
    }

    if (!RESOLUTION_TYPES.includes(resolution)) {
      return res.status(400).json({
        success: false,
        message: 'يرجى الإجابة عن سؤال: هل تم حل المشكلة؟ (نعم، جزئيًا، أو لا).'
      });
    }

    const adapter = await getDatabaseAdapter();
    const id = String(rawId || '').trim().toUpperCase();

    const rating = await adapter.saveRating(id, {
      stars: parsedStars,
      resolution,
      comment: comment ? String(comment).slice(0, 1000).trim() : ''
    });

    res.status(201).json({
      success: true,
      message: 'شكرًا لك! تم حفظ تقييمك لمساعدتنا في تحسين خدمات الجامعة.',
      data: rating
    });
  } catch (error) {
    if (error.message.includes('بعد حلّها') || error.message.includes('سبق حفظ')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    next(error);
  }
}

export async function getRating(req, res, next) {
  try {
    const id = String(req.params.id || '').trim().toUpperCase();
    const adapter = await getDatabaseAdapter();
    const rating = await adapter.getRating(id);

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'لا يوجد تقييم مسجل لهذه الشكوى.'
      });
    }

    res.json({
      success: true,
      data: rating
    });
  } catch (error) {
    next(error);
  }
}
