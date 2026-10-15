/**
 * Palestine Polytechnic University (PPU) - Complaints System
 * Enterprise Email & Notification Service
 * Supports Nodemailer SMTP transport with automatic console simulation fallback.
 */
import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

function escapeHtml(str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class NotificationService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    if (config.smtp.enabled && config.smtp.host) {
      try {
        const transportOptions = {
          host: config.smtp.host,
          port: config.smtp.port,
          secure: config.smtp.secure,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000
        };

        if (config.smtp.user && config.smtp.pass) {
          transportOptions.auth = {
            user: config.smtp.user,
            pass: config.smtp.pass
          };
        }

        this.transporter = nodemailer.createTransport(transportOptions);
      } catch (err) {
        console.error('[SMTP INIT ERROR] Failed to initialize Nodemailer transport:', err.message);
        this.transporter = null;
      }
    } else {
      this.transporter = null;
    }
  }

  async verifySmtp() {
    if (!config.smtp.enabled) {
      return {
        enabled: false,
        connected: false,
        message: 'خدمة SMTP معطلة حالياً في ملف الإعدادات (ENABLE_SMTP=false). يتم تسجيل الإشعارات في الطرفية (Simulation).'
      };
    }

    if (!this.transporter) {
      this.initTransporter();
    }

    if (!this.transporter) {
      return {
        enabled: true,
        connected: false,
        message: 'تعذر إنشاء عميل SMTP. تحقق من بيانات الخادم في ملف الإعدادات.'
      };
    }

    try {
      await this.transporter.verify();
      return {
        enabled: true,
        connected: true,
        host: config.smtp.host,
        port: config.smtp.port,
        message: 'الاتصال بخادم SMTP نشط وجاهز لإرسال الرسائل بنجاح.'
      };
    } catch (error) {
      return {
        enabled: true,
        connected: false,
        error: error.message,
        message: `فشل فحص اتصال SMTP: ${error.message}`
      };
    }
  }

  /**
   * Generic sender with SMTP execution and console fallback
   */
  async sendMail({ to, subject, text, html, replyTo }) {
    let sentViaSmtp = false;
    let smtpError = null;

    if (config.smtp.enabled && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: config.smtp.from,
          to,
          replyTo: replyTo || config.smtp.replyTo,
          subject,
          text,
          html
        });
        sentViaSmtp = true;
        console.log(`[SMTP SUCCESS] Real email sent to <${to}>: "${subject}"`);
      } catch (err) {
        smtpError = err.message;
        console.error(`[SMTP ERROR] Failed to send email to <${to}>:`, err.message);
      }
    }

    // Always log if simulation is enabled or SMTP failed
    if (config.enableEmailLog || !sentViaSmtp) {
      const mode = sentViaSmtp ? 'Delivered via SMTP' : (smtpError ? `Fallback (SMTP Failed: ${smtpError})` : 'Console Simulation');
      const logBox = `
================================================================================
[OUTGOING EMAIL NOTIFICATION] (${mode})
--------------------------------------------------------------------------------
To     : ${to}
Subject: ${subject}
From   : ${config.smtp.from}
Body   :
${text}
================================================================================
      `.trim();
      console.log(logBox);
    }

    return {
      success: sentViaSmtp || !config.smtp.enabled,
      sentViaSmtp,
      smtpError
    };
  }

  /**
   * Professional University Branded HTML Email Wrapper
   */
  generateHtmlTemplate({ title, greeting, paragraphs = [], badge = null, actionBtn = null, details = [] }) {
    const detailsHtml = details.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 14px;">
        <tbody>
          ${details.map(d => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 14px; font-weight: bold; color: #334155; width: 35%; text-align: right;">${escapeHtml(d.label)}</td>
              <td style="padding: 10px 14px; color: #0f172a; text-align: right;">${escapeHtml(d.value)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '';

    const btnHtml = actionBtn ? `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${escapeHtml(actionBtn.url)}" style="display: inline-block; background-color: #16324F; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          ${escapeHtml(actionBtn.text)}
        </a>
      </div>
    ` : '';

    const badgeHtml = badge ? `
      <span style="display: inline-block; background-color: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: bold; margin-bottom: 12px;">
        ${escapeHtml(badge)}
      </span>
    ` : '';

    return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; color: #1e293b;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 30px 15px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #16324F 0%, #1e40af 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: -0.5px;">جامعة بوليتكنك فلسطين</h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: #cbd5e1;">نظام الشكاوى الموحد — معًا، لجامعة أفضل</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              ${badgeHtml}
              <h2 style="margin: 0 0 16px; font-size: 18px; color: #0f172a;">${escapeHtml(greeting)}</h2>
              
              ${paragraphs.map(p => `
                <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.7; color: #334155;">${escapeHtml(p)}</p>
              `).join('')}

              ${detailsHtml}
              ${btnHtml}

              <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
                <p style="margin: 0 0 6px;">ملاحظة: هذا البريد الإلكتروني أُرسل تلقائيًا من المنظومة الجامعية الموحدة لجامعة بوليتكنك فلسطين.</p>
                <p style="margin: 0;">لأي استفسارات إضافية، يرجى التوجه لعمادة شؤون الطلبة بالحرم الجامعي.</p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
              © ${new Date().getFullYear()} جامعة بوليتكنك فلسطين — كافة الحقوق محفوظة
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * 1. Send Complaint Confirmation
   */
  async sendComplaintConfirmation({ email, fullName, complaintId, title, serviceName, phone = null }) {
    const trackingUrl = `${config.appUrl}/#track/${encodeURIComponent(complaintId)}`;
    const subject = `تأكيد استلام الشكوى #${complaintId} — جامعة بوليتكنك فلسطين`;

    const text = `
عزيزي/عزيزتي ${fullName} المحترم/ة،
تحية طيبة وبعد،

تم بنجاح تسجيل شكواكم في المنظومة الموحدة لجامعة بوليتكنك فلسطين.
- رقم التتبع : ${complaintId}
- نوع الخدمة : ${serviceName}
- موضوع الشكوى: ${title}
${phone ? `- هاتف التواصل (واتساب): ${phone}\n` : ''}
يمكنكم متابعة حالة الشكوى وردود الإدارة في أي وقت عبر الرابط التالي:
${trackingUrl}

مع تحيات عمادة شؤون الطلبة والدعم الأكاديمي
جامعة بوليتكنك فلسطين
    `.trim();

    const details = [
      { label: 'رقم التتبع المعتمد', value: complaintId },
      { label: 'القسم المختص', value: serviceName },
      { label: 'عنوان الشكوى', value: title }
    ];

    if (phone) {
      details.push({ label: 'رقم هاتف الواتساب المسجل', value: phone });
    }

    const html = this.generateHtmlTemplate({
      title: subject,
      greeting: `مرحبًا ${fullName}،`,
      badge: 'تأكيد التسجيل الرسمي',
      paragraphs: [
        'نحيطكم علماً بأن شكواكم قد سُجّلت بنجاح في قاعدة البيانات المركزية لجامعة بوليتكنك فلسطين، وأُحيلت رسمياً للقسم المختص للمباشرة بمعاينتها.',
        'يمكنكم في أي لحظة التحقق من حالة المعالجة وملاحظات المشرفين الرسمية عبر الرابط أدناه:'
      ],
      details,
      actionBtn: {
        text: 'متابعة الشكوى عبر البوابة الإلكترونية',
        url: trackingUrl
      }
    });

    return this.sendMail({ to: email, subject, text, html });
  }

  /**
   * 2. Send Complaint Resolved Notification
   */
  async sendComplaintResolvedNotification({ email, fullName, complaintId, officialReply, serviceName }) {
    const trackingUrl = `${config.appUrl}/#track/${encodeURIComponent(complaintId)}`;
    const subject = `تم الحل بنجاح: الشكوى #${complaintId} — جامعة بوليتكنك فلسطين`;

    const text = `
عزيزي/عزيزتي ${fullName} المحترم/ة،
يسرنا إعلامكم باكتمال معالجة شكواكم رقم (${complaintId}) المتعلقة بقسم ${serviceName || 'الجامعة'}.

الرد الرسمي المعتمد:
"${officialReply}"

ندعوكم لزيارة بوابة المتابعة لتقييم جودة الخدمة ومساعدتنا في التطوير المستمر:
${trackingUrl}

شاكرين لكم مساهمتكم في رفعة وتطوير جامعتنا.
إدارة جامعة بوليتكنك فلسطين
    `.trim();

    const html = this.generateHtmlTemplate({
      title: subject,
      greeting: `أهلاً ${fullName}،`,
      badge: 'تم الحل بنجاح ✅',
      paragraphs: [
        `يسعدنا إفادتكم باكتمال معالجة الشكوى رقم (${complaintId}) والتأكد من إنجاز الإجراءات المطلوبة ميدانياً.`,
        'نص الرد الرسمي الصادر عن الإدارة الجامعية:'
      ],
      details: [
        { label: 'رقم الشكوى', value: complaintId },
        { label: 'الرد الرسمي', value: officialReply }
      ],
      actionBtn: {
        text: 'تقييم جودة المعالجة والخدمة',
        url: trackingUrl
      }
    });

    return this.sendMail({ to: email, subject, text, html });
  }

  /**
   * 3. Send Custom Canned Notification (Follow-up, Summon, Delay, etc.)
   */
  async sendCustomCannedNotification({ email, fullName, complaintId, subject, bodyText, trackingUrl, badgeText = 'إشعار إداري' }) {
    const url = trackingUrl || `${config.appUrl}/#track/${encodeURIComponent(complaintId)}`;

    const text = `${bodyText}\n\nرابط المتابعة: ${url}`;
    const paragraphs = bodyText.split('\n\n').filter(Boolean);

    const html = this.generateHtmlTemplate({
      title: subject,
      greeting: `حضرة الطالب/ة ${fullName}،`,
      badge: badgeText,
      paragraphs,
      details: [
        { label: 'رقم الشكوى', value: complaintId }
      ],
      actionBtn: {
        text: 'الانتقال إلى صفحة الشكوى',
        url
      }
    });

    return this.sendMail({ to: email, subject, text, html });
  }
}

export default new NotificationService();
