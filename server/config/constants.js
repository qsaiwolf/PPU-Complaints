/**
 * PPU Complaints System - Central Constants
 * All business domain constants, valid services, statuses, roles, and priorities.
 */

export const SERVICES = [
  { id: 'internet', name: 'الإنترنت', icon: 'wifi', description: 'شبكة الإنترنت وخدماتها', color: 'teal' },
  { id: 'classrooms', name: 'القاعات والمقاعد', icon: 'chairs', description: 'القاعات الدراسية والمقاعد', color: 'blue' },
  { id: 'cleanliness', name: 'النظافة', icon: 'broom', description: 'نظافة المباني والمرافق العامة', color: 'teal' },
  { id: 'facilities', name: 'المرافق', icon: 'building', description: 'المرافق العامة والمياه والكهرباء', color: 'blue' },
  { id: 'library', name: 'المكتبة', icon: 'book', description: 'مكتبة الجامعة ومصادر التعلّم', color: 'teal' },
  { id: 'other', name: 'خدمات أخرى', icon: 'dots', description: 'أي خدمة أخرى تحتاج إلى تحسين', color: 'blue' }
];

export const STATUSES = [
  'تم الإرسال',      // 0: Submitted
  'قيد المراجعة',    // 1: Under Review
  'قيد المعالجة',    // 2: In Progress
  'تم الحل'          // 3: Resolved
];

export const PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

export const ADMIN_ROLES = {
  SUPER_ADMIN: 'super_admin',
  DEPARTMENT_ADMIN: 'department_admin'
};

export const RESOLUTION_TYPES = ['yes', 'partial', 'no'];
