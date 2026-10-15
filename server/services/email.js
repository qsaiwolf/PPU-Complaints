/**
 * Notification Service (Email Engine with Console Simulation)
 */
import { config } from '../config/env.js';

class NotificationService {
  async sendComplaintConfirmation({ email, fullName, complaintId, title, serviceName }) {
    if (!config.enableEmailLog) return;

    const message = `
================================================================================
📧 [إشعار بريد إلكتروني صادر للطالب]
--------------------------------------------------------------------------------
إلى: ${fullName} <${email}>
الموضوع: تأكيد استلام شكوى رقم: ${complaintId} — جامعة بوليتكنك فلسطين
المحتوى:
مرحبًا ${fullName}،
تم استلام شكواك بنجاح في قسم (${serviceName}).
- رقم المتابعة الخاص بك: ${complaintId}
- عنوان الشكوى: ${title}
يمكنك في أي وقت تتبع حالة الشكوى والرد عبر بوابة المتابعة باستخدام رقم الشكوى أعلاه.
مع تحيات، وحدة الشكاوى والدعم الفني — جامعة بوليتكنك فلسطين
================================================================================
    `.trim();

    console.log(message);
  }

  async sendComplaintResolvedNotification({ email, fullName, complaintId, officialReply }) {
    if (!config.enableEmailLog) return;

    const message = `
================================================================================
📧 [إشعار بريد إلكتروني صادر للطالب]
--------------------------------------------------------------------------------
إلى: ${fullName} <${email}>
الموضوع: تم حل شكواك رقم: ${complaintId} — جامعة بوليتكنك فلسطين
المحتوى:
مرحبًا ${fullName}،
يسعدنا إعلامك بأنه تم حل الشكوى الخاصة بك بنجاح.
- الرد الرسمي للجامعة:
"${officialReply}"

يرجى التوجه إلى صفحة المتابعة لتقييم جودة الخدمة لمساعدتنا في تحسين التجربة الجامعية.
مع تحيات، إدارة الجامعة — جامعة بوليتكنك فلسطين
================================================================================
    `.trim();

    console.log(message);
  }
}

export default new NotificationService();
