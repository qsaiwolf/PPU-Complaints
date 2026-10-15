/**
 * Complaints Controller
 * Handles student submission, tracking, auto-priority classification, and search.
 */
import crypto from 'node:crypto';
import { getDatabaseAdapter } from '../database/connection.js';
import { SERVICES, STATUSES } from '../config/constants.js';
import emailService from '../services/email.js';

function normalizeId(value) {
  return String(value || '')
    .trim()
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .toUpperCase();
}

function detectAutoPriority(title = '', description = '') {
  const urgentKeywords = /(حريق|تسرب|التماس|كهرباء|طوارئ|خطر|سقوط|مكسور|غاز|إصابة)/i;
  const highKeywords = /(انقطاع|معطل|تالف|لا يعمل|مشكلة حرجة)/i;

  const content = `${title} ${description}`;
  if (urgentKeywords.test(content)) return 'urgent';
  if (highKeywords.test(content)) return 'high';
  return 'medium';
}

export async function createComplaint(req, res, next) {
  try {
    const { fullName, major, studentId, email, service, location, title, description } = req.body;

    // Strict validation
    if (!fullName || !email || !service || !location || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'يرجى ملء جميع الحقول الإلزامية للشكوى.'
      });
    }

    // Verify valid service
    const validService = SERVICES.find(s => s.id === service);
    if (!validService) {
      return res.status(400).json({
        success: false,
        message: 'نوع الخدمة المحددة غير صالح.'
      });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'صيغة البريد الإلكتروني المدخلة غير صحيحة.'
      });
    }

    const adapter = await getDatabaseAdapter();

    // Generate unique complaint ID: PPU-YYYY-XXXX
    let id;
    let exists = false;
    do {
      const randHex = crypto.randomBytes(4).toString('hex').slice(0, 4).toUpperCase();
      id = `PPU-${new Date().getFullYear()}-${randHex}`;
      const record = await adapter.findComplaintById(id);
      exists = Boolean(record);
    } while (exists);

    // Check attachment from Multer
    const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const priority = detectAutoPriority(title, description);

    const newComplaint = await adapter.createComplaint({
      id,
      fullName: String(fullName).trim(),
      major: major ? String(major).trim() : '',
      studentId: studentId ? String(studentId).trim() : '',
      email: String(email).trim().toLowerCase(),
      service,
      location: String(location).trim(),
      title: String(title).trim(),
      description: String(description).trim(),
      priority,
      attachmentUrl
    });

    // Send confirmation email simulation
    emailService.sendComplaintConfirmation({
      email: newComplaint.email,
      fullName: newComplaint.full_name,
      complaintId: newComplaint.id,
      title: newComplaint.title,
      serviceName: validService.name
    }).catch(e => console.error('Email trigger failed:', e.message));

    res.status(201).json({
      success: true,
      message: 'تم إرسال شكواك بنجاح وحفظها في قاعدة البيانات.',
      data: {
        id: newComplaint.id,
        status: newComplaint.status,
        statusText: STATUSES[newComplaint.status],
        priority: newComplaint.priority,
        createdAt: newComplaint.created_at
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getComplaintById(req, res, next) {
  try {
    const rawId = req.params.id;
    if (!rawId) {
      return res.status(400).json({ success: false, message: 'رقم الشكوى مطلوب.' });
    }

    const id = normalizeId(rawId);
    const adapter = await getDatabaseAdapter();
    const complaint = await adapter.findComplaintById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على شكوى مطابقة لهذا الرقم. تأكد من صحة الرمز ثم حاول مجددًا.'
      });
    }

    // Format for student view (do not leak internal staff notes)
    const sanitized = {
      id: complaint.id,
      fullName: complaint.full_name,
      major: complaint.major || '',
      email: complaint.email,
      service: complaint.service_id,
      serviceName: complaint.service_name || complaint.service_id,
      serviceIcon: complaint.service_icon || 'chat',
      location: complaint.location,
      title: complaint.title,
      description: complaint.description,
      status: complaint.status,
      statusText: STATUSES[complaint.status] || 'غير محدد',
      priority: complaint.priority,
      officialReply: complaint.official_reply || '',
      attachmentUrl: complaint.attachment_url,
      createdAt: complaint.created_at,
      updatedAt: complaint.updated_at,
      rating: complaint.rating,
      logs: complaint.logs.map(log => ({
        oldStatus: log.old_status,
        newStatus: log.new_status,
        actionType: log.action_type,
        performedBy: log.performed_by,
        details: log.details,
        createdAt: log.created_at
      }))
    };

    res.json({
      success: true,
      data: sanitized
    });
  } catch (error) {
    next(error);
  }
}

export async function listComplaints(req, res, next) {
  try {
    const adapter = await getDatabaseAdapter();
    const complaints = await adapter.getComplaints({
      service: req.query.service,
      status: req.query.status,
      priority: req.query.priority,
      search: req.query.search,
      limit: req.query.limit,
      offset: req.query.offset
    });

    const formatted = complaints.map(c => ({
      id: c.id,
      fullName: c.full_name,
      major: c.major || '',
      service: c.service_id,
      serviceName: c.service_name || c.service_id,
      location: c.location,
      title: c.title,
      description: c.description,
      status: c.status,
      statusText: STATUSES[c.status] || 'غير محدد',
      priority: c.priority,
      officialReply: c.official_reply || '',
      attachmentUrl: c.attachment_url,
      createdAt: c.created_at
    }));

    res.json({
      success: true,
      data: formatted,
      meta: {
        count: formatted.length
      }
    });
  } catch (error) {
    next(error);
  }
}
