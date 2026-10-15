/**
 * Admin Controller
 * Handles authentication, complaint status transitions, staff notes, canned replies, SMTP notifications, and CSV exports.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabaseAdapter } from '../database/connection.js';
import { config } from '../config/env.js';
import { STATUSES, PRIORITIES } from '../config/constants.js';
import { CANNED_CATEGORIES, CANNED_REPLIES, interpolateCannedReply } from '../config/canned-replies.js';
import emailService from '../services/email.js';
import { buildWhatsAppLink } from '../utils/phone.js';

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
    const { status, officialReply, priority, sendEmail } = req.body;

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

    // Notify student: if resolved or if sendEmail is explicitly true
    const replyText = officialReply !== undefined ? String(officialReply).trim() : existing.official_reply;

    if (parsedStatus === 3 && replyText) {
      emailService.sendComplaintResolvedNotification({
        email: existing.email,
        fullName: existing.full_name,
        complaintId: existing.id,
        officialReply: replyText,
        serviceName: existing.service_name || existing.service_id
      }).catch(e => console.error('[RESOLUTION EMAIL ERROR]', e.message));
    } else if (sendEmail && replyText) {
      const trackingUrl = `${config.appUrl}/#track/${encodeURIComponent(existing.id)}`;
      emailService.sendCustomCannedNotification({
        email: existing.email,
        fullName: existing.full_name,
        complaintId: existing.id,
        subject: `تحديث بخصوص الشكوى #${existing.id} — جامعة بوليتكنك فلسطين`,
        bodyText: replyText,
        trackingUrl,
        badgeText: 'تحديث حالة الشكوى'
      }).catch(e => console.error('[UPDATE EMAIL ERROR]', e.message));
    }

    res.json({
      success: true,
      message: 'تم تحديث حالة الشكوى وحفظ الإجراء بنجاح.',
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
    csv += 'رقم الشكوى,اسم الطالب,التخصص,البريد الإلكتروني,دولة الهاتف,رقم الهاتف,رقم الواتساب الدولي,الخدمة,الموقع,عنوان المشكلة,الحالة,الأولوية,الرد الرسمي,تاريخ التقديم\n';

    for (const c of complaints) {
      const row = [
        `"${c.id}"`,
        `"${(c.full_name || '').replace(/"/g, '""')}"`,
        `"${(c.major || '').replace(/"/g, '""')}"`,
        `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${(c.phone_country || '').toUpperCase()}"`,
        `"${(c.phone || '').replace(/"/g, '""')}"`,
        `"${(c.phone_full ? '+' + c.phone_full : '').replace(/"/g, '""')}"`,
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

/**
 * Return canned reply catalog with all categories and templates
 */
export async function getCannedReplies(req, res, next) {
  try {
    res.json({
      success: true,
      data: {
        categories: CANNED_CATEGORIES,
        replies: CANNED_REPLIES
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Send notification to student (Email via SMTP or prepare WhatsApp link)
 */
export async function sendCannedNotification(req, res, next) {
  try {
    const { complaintId, cannedId, customBody, customSubject, channel } = req.body;

    if (!complaintId) {
      return res.status(400).json({ success: false, message: 'رقم الشكوى مطلوب.' });
    }

    const adapter = await getDatabaseAdapter();
    const complaint = await adapter.findComplaintById(complaintId);

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'الشكوى غير موجودة.' });
    }

    const canned = CANNED_REPLIES.find(r => r.id === cannedId);
    const trackingUrl = `${config.appUrl}/#track/${encodeURIComponent(complaint.id)}`;

    const variables = {
      studentName: complaint.full_name || 'الطالب',
      complaintId: complaint.id,
      title: complaint.title || '',
      serviceName: complaint.service_name || complaint.service_id || '',
      location: complaint.location || '',
      trackingUrl
    };

    // Determine subject and bodies
    const emailSubject = customSubject || (canned ? interpolateCannedReply(canned.emailSubject, variables) : `إشعار بخصوص شكواكم رقم ${complaint.id}`);
    const emailBody = customBody || (canned ? interpolateCannedReply(canned.emailBody, variables) : '');
    const waText = canned ? interpolateCannedReply(canned.whatsappMessage, variables) : (customBody || '');

    if (channel === 'whatsapp') {
      if (!complaint.phone_full) {
        return res.status(400).json({
          success: false,
          message: 'لم يقم الطالب بإدخال رقم هاتف عند تقديم هذه الشكوى.'
        });
      }

      const waLink = buildWhatsAppLink(complaint.phone_full, waText);

      // Log action in audit logs
      await adapter.addAuditLog({
        complaintId: complaint.id,
        oldStatus: complaint.status,
        newStatus: complaint.status,
        actionType: 'WHATSAPP_DISPATCH',
        performedBy: req.admin.fullName,
        details: `تم إنشاء رسالة واتساب للرقم الدولي (+${complaint.phone_full})`
      });

      return res.json({
        success: true,
        message: 'تم تجهيز رابط محادثة واتساب بنجاح.',
        data: {
          phoneFull: complaint.phone_full,
          waLink,
          messageText: waText
        }
      });
    }

    // Default: Channel is Email via SMTP
    const sendResult = await emailService.sendCustomCannedNotification({
      email: complaint.email,
      fullName: complaint.full_name,
      complaintId: complaint.id,
      subject: emailSubject,
      bodyText: emailBody,
      trackingUrl,
      badgeText: canned ? canned.title : 'إشعار إداري رسمي'
    });

    // Log action in audit logs
    await adapter.addAuditLog({
      complaintId: complaint.id,
      oldStatus: complaint.status,
      newStatus: complaint.status,
      actionType: 'EMAIL_DISPATCH',
      performedBy: req.admin.fullName,
      details: `تم إرسال إشعار بريد إلكتروني رسمي (${emailSubject}) عبر ${sendResult.sentViaSmtp ? 'SMTP' : 'محاكي الإشعارات'}`
    });

    res.json({
      success: true,
      message: sendResult.sentViaSmtp ? 'تم إرسال الإشعار إلى بريد الطالب بنجاح عبر خادم SMTP.' : 'تم تسجيل الإشعار بنجاح (Simulation mode).',
      data: {
        sentViaSmtp: sendResult.sentViaSmtp,
        email: complaint.email,
        subject: emailSubject
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Check SMTP connection health
 */
export async function getSmtpStatus(req, res, next) {
  try {
    const status = await emailService.verifySmtp();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
}
