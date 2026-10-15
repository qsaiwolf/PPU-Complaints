/**
 * Admin Controller
 * Handles authentication, complaint status transitions, staff notes, analytics, and CSV exports.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabaseAdapter } from '../database/connection.js';
import { config } from '../config/env.js';
import { STATUSES, PRIORITIES } from '../config/constants.js';
import emailService from '../services/email.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.'
      });
    }

    const adapter = await getDatabaseAdapter();
    const admin = await adapter.findAdminByEmail(String(email).trim().toLowerCase());

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة. تأكد من البريد وكلمة المرور.'
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة. تأكد من البريد وكلمة المرور.'
      });
    }

    // Generate JWT token valid for 7 days
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role,
        departmentServiceId: admin.department_service_id
      },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: `أهلاً بك، ${admin.full_name}. تم تسجيل الدخول بنجاح.`,
      data: {
        token,
        admin: {
          id: admin.id,
          fullName: admin.full_name,
          email: admin.email,
          role: admin.role,
          departmentServiceId: admin.department_service_id
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    res.json({
      success: true,
      data: req.admin
    });
  } catch (error) {
    next(error);
  }
}

export async function updateComplaint(req, res, next) {
  try {
    const id = String(req.params.id || '').trim().toUpperCase();
    const { status, officialReply, priority } = req.body;

    const adapter = await getDatabaseAdapter();
    const existing = await adapter.findComplaintById(id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'الشكوى المطلوب تعديلها غير موجودة.'
      });
    }

    // Department admin check: can only edit complaints in their department
    if (req.admin.role === 'department_admin' && req.admin.departmentServiceId) {
      if (existing.service_id !== req.admin.departmentServiceId) {
        return res.status(403).json({
          success: false,
          message: 'ليس لديك صلاحية لتعديل شكوى تابعة لقسم آخر.'
        });
      }
    }

    const parsedStatus = status !== undefined ? Number(status) : undefined;
    if (parsedStatus !== undefined && (!Number.isInteger(parsedStatus) || parsedStatus < 0 || parsedStatus > 3)) {
      return res.status(400).json({
        success: false,
        message: 'حالة الشكوى غير صالحة. القيم المسموحة من 0 إلى 3.'
      });
    }

    const updated = await adapter.updateComplaintStatus(id, {
      status: parsedStatus,
      officialReply: officialReply !== undefined ? String(officialReply).trim() : undefined,
      priority: priority !== undefined ? priority : undefined,
      performedBy: req.admin.fullName
    });

    // If resolved, notify student
    if (parsedStatus === 3 && officialReply) {
      emailService.sendComplaintResolvedNotification({
        email: existing.email,
        fullName: existing.full_name,
        complaintId: existing.id,
        officialReply
      }).catch(e => console.error('Resolution email trigger failed:', e.message));
    }

    res.json({
      success: true,
      message: 'تم تحديث حالة الشكوى وإضافة الرد بنجاح.',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

export async function addInternalNote(req, res, next) {
  try {
    const id = String(req.params.id || '').trim().toUpperCase();
    const { note } = req.body;

    if (!note || !String(note).trim()) {
      return res.status(400).json({
        success: false,
        message: 'نص الملاحظة مطلوب.'
      });
    }

    const adapter = await getDatabaseAdapter();
    const existing = await adapter.findComplaintById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'الشكوى غير موجودة.' });
    }

    await adapter.addInternalNote({
      complaintId: id,
      adminId: req.admin.id,
      note: String(note).trim()
    });

    res.status(201).json({
      success: true,
      message: 'تمت إضافة الملاحظة الداخلية بنجاح.'
    });
  } catch (error) {
    next(error);
  }
}

export async function getStats(req, res, next) {
  try {
    const adapter = await getDatabaseAdapter();
    const stats = await adapter.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

export async function exportCsv(req, res, next) {
  try {
    const adapter = await getDatabaseAdapter();
    const complaints = await adapter.getComplaints({ limit: 10000 });

    // UTF-8 BOM for Microsoft Excel Arabic support
    let csv = '\uFEFF';
    csv += 'رقم الشكوى,اسم الطالب,التخصص,البريد الإلكتروني,الخدمة,الموقع,عنوان المشكلة,الحالة,الأولوية,الرد الرسمي,تاريخ التقديم\n';

    for (const c of complaints) {
      const row = [
        `"${c.id}"`,
        `"${(c.full_name || '').replace(/"/g, '""')}"`,
        `"${(c.major || '').replace(/"/g, '""')}"`,
        `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${(c.service_name || c.service_id || '').replace(/"/g, '""')}"`,
        `"${(c.location || '').replace(/"/g, '""')}"`,
        `"${(c.title || '').replace(/"/g, '""')}"`,
        `"${STATUSES[c.status] || c.status}"`,
        `"${c.priority || 'medium'}"`,
        `"${(c.official_reply || '').replace(/"/g, '""')}"`,
        `"${c.created_at}"`
      ];
      csv += row.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ppu-complaints-export-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
}
