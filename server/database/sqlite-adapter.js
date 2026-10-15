/**
 * SQLite Database Adapter
 * High-performance, zero-external-dependency local database driver using Node.js built-in node:sqlite.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.js';
import { SERVICES } from '../config/constants.js';

class SQLiteAdapter {
  constructor() {
    this.db = null;
    this.engineName = 'sqlite';
  }

  async init() {
    // Ensure data directory exists
    const dir = path.dirname(config.sqlitePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(config.sqlitePath);
    
    // Enable WAL mode and foreign keys for high performance and integrity
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');

    this.runMigrations();
  }

  runMigrations() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name_ar TEXT NOT NULL,
        icon TEXT NOT NULL,
        description TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'department_admin' CHECK(role IN ('super_admin', 'department_admin')),
        department_service_id TEXT REFERENCES services(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        student_id TEXT,
        email TEXT NOT NULL,
        service_id TEXT NOT NULL REFERENCES services(id),
        location TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
        official_reply TEXT,
        attachment_url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_complaints_service ON complaints(service_id);
      CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
      CREATE INDEX IF NOT EXISTS idx_complaints_priority ON complaints(priority);
      CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at DESC);

      CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT NOT NULL UNIQUE REFERENCES complaints(id) ON DELETE CASCADE,
        stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
        resolution TEXT NOT NULL CHECK (resolution IN ('yes', 'partial', 'no')),
        comment TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS complaint_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
        old_status INTEGER,
        new_status INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_logs_complaint ON complaint_logs(complaint_id);

      CREATE TABLE IF NOT EXISTS internal_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
        admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Seed default services
    const insertService = this.db.prepare(`
      INSERT OR IGNORE INTO services (id, name_ar, icon, description)
      VALUES (?, ?, ?, ?)
    `);

    for (const service of SERVICES) {
      insertService.run(service.id, service.name, service.icon, service.description);
    }
  }

  async getServices() {
    return this.db.prepare('SELECT * FROM services ORDER BY id ASC').all();
  }

  async findComplaintById(id) {
    const complaint = this.db.prepare(`
      SELECT c.*, s.name_ar as service_name, s.icon as service_icon
      FROM complaints c
      LEFT JOIN services s ON c.service_id = s.id
      WHERE c.id = ?
    `).get(id);

    if (!complaint) return null;

    const rating = this.db.prepare('SELECT * FROM ratings WHERE complaint_id = ?').get(id);
    const logs = this.db.prepare('SELECT * FROM complaint_logs WHERE complaint_id = ? ORDER BY created_at ASC').all(id);
    const notes = this.db.prepare(`
      SELECT n.*, a.full_name as admin_name
      FROM internal_notes n
      LEFT JOIN admins a ON n.admin_id = a.id
      WHERE n.complaint_id = ?
      ORDER BY n.created_at ASC
    `).all(id);

    return {
      ...complaint,
      rating: rating || null,
      logs: logs || [],
      internalNotes: notes || []
    };
  }

  async createComplaint(data) {
    const stmt = this.db.prepare(`
      INSERT INTO complaints (id, full_name, student_id, email, service_id, location, title, description, status, priority, official_reply, attachment_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '', ?, datetime('now'), datetime('now'))
    `);

    stmt.run(
      data.id,
      data.fullName,
      data.studentId || null,
      data.email,
      data.service,
      data.location,
      data.title,
      data.description,
      data.priority || 'medium',
      data.attachmentUrl || null
    );

    // Initial audit log
    this.addAuditLog({
      complaintId: data.id,
      oldStatus: null,
      newStatus: 0,
      actionType: 'SUBMITTED',
      performedBy: data.fullName,
      details: 'تم تقديم الشكوى بنجاح عبر بوابة الطالب'
    });

    return this.findComplaintById(data.id);
  }

  async getComplaints(filters = {}) {
    let sql = `
      SELECT c.*, s.name_ar as service_name, s.icon as service_icon
      FROM complaints c
      LEFT JOIN services s ON c.service_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.service && filters.service !== 'all') {
      sql += ' AND c.service_id = ?';
      params.push(filters.service);
    }

    if (filters.status !== undefined && filters.status !== null && filters.status !== 'all') {
      sql += ' AND c.status = ?';
      params.push(Number(filters.status));
    }

    if (filters.priority && filters.priority !== 'all') {
      sql += ' AND c.priority = ?';
      params.push(filters.priority);
    }

    if (filters.search) {
      sql += ' AND (c.id LIKE ? OR c.full_name LIKE ? OR c.title LIKE ? OR c.location LIKE ? OR c.email LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY c.created_at DESC';

    const limit = Number(filters.limit) || 100;
    const offset = Number(filters.offset) || 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.prepare(sql).all(...params);
  }

  async updateComplaintStatus(id, { status, officialReply, priority, performedBy }) {
    const existing = await this.findComplaintById(id);
    if (!existing) return null;

    const newStatus = status !== undefined ? Number(status) : existing.status;
    const newReply = officialReply !== undefined ? officialReply : existing.official_reply;
    const newPriority = priority !== undefined ? priority : existing.priority;

    this.db.prepare(`
      UPDATE complaints
      SET status = ?, official_reply = ?, priority = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newStatus, newReply, newPriority, id);

    // Log the change
    this.addAuditLog({
      complaintId: id,
      oldStatus: existing.status,
      newStatus: newStatus,
      actionType: 'STATUS_CHANGED',
      performedBy: performedBy || 'إدارة الجامعة',
      details: officialReply ? `تم تحديث الحالة وكتابة رد رسمي: "${officialReply.slice(0, 50)}..."` : `تم تغيير الحالة إلى ${newStatus}`
    });

    return this.findComplaintById(id);
  }

  async saveRating(id, { stars, resolution, comment }) {
    const complaint = await this.findComplaintById(id);
    if (!complaint) throw new Error('الشكوى غير موجودة');
    if (complaint.status !== 3) throw new Error('يمكن تقييم الشكوى بعد حلّها فقط.');
    if (complaint.rating) throw new Error('سبق حفظ تقييم لهذه الشكوى.');

    this.db.prepare(`
      INSERT INTO ratings (complaint_id, stars, resolution, comment, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(id, stars, resolution, comment || null);

    this.addAuditLog({
      complaintId: id,
      oldStatus: 3,
      newStatus: 3,
      actionType: 'RATING_ADDED',
      performedBy: complaint.full_name,
      details: `تم تقييم المعالجة بـ ${stars} نجوم (${resolution})`
    });

    return this.db.prepare('SELECT * FROM ratings WHERE complaint_id = ?').get(id);
  }

  async getRating(id) {
    return this.db.prepare('SELECT * FROM ratings WHERE complaint_id = ?').get(id) || null;
  }

  async addAuditLog({ complaintId, oldStatus, newStatus, actionType, performedBy, details }) {
    this.db.prepare(`
      INSERT INTO complaint_logs (complaint_id, old_status, new_status, action_type, performed_by, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(complaintId, oldStatus !== undefined ? oldStatus : null, newStatus, actionType, performedBy, details || null);
  }

  async addInternalNote({ complaintId, adminId, note }) {
    this.db.prepare(`
      INSERT INTO internal_notes (complaint_id, admin_id, note, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(complaintId, adminId, note);
  }

  async findAdminByEmail(email) {
    return this.db.prepare('SELECT * FROM admins WHERE email = ?').get(email) || null;
  }

  async findAdminById(id) {
    return this.db.prepare('SELECT id, full_name, email, role, department_service_id, created_at FROM admins WHERE id = ?').get(id) || null;
  }

  async createAdmin({ fullName, email, passwordHash, role, departmentServiceId }) {
    const stmt = this.db.prepare(`
      INSERT INTO admins (full_name, email, password_hash, role, department_service_id, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    const result = stmt.run(fullName, email, passwordHash, role || 'department_admin', departmentServiceId || null);
    return this.findAdminById(result.lastInsertRowid);
  }

  async getStats() {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM complaints').get().count;
    const pending = this.db.prepare('SELECT COUNT(*) as count FROM complaints WHERE status = 0').get().count;
    const reviewing = this.db.prepare('SELECT COUNT(*) as count FROM complaints WHERE status = 1').get().count;
    const processing = this.db.prepare('SELECT COUNT(*) as count FROM complaints WHERE status = 2').get().count;
    const resolved = this.db.prepare('SELECT COUNT(*) as count FROM complaints WHERE status = 3').get().count;

    const avgRatingRow = this.db.prepare('SELECT AVG(stars) as avg, COUNT(*) as count FROM ratings').get();
    const byService = this.db.prepare(`
      SELECT s.id, s.name_ar, COUNT(c.id) as count
      FROM services s
      LEFT JOIN complaints c ON s.id = c.service_id
      GROUP BY s.id
      ORDER BY count DESC
    `).all();

    return {
      total,
      pending,
      reviewing,
      processing,
      resolved,
      averageRating: avgRatingRow && avgRatingRow.avg ? Number(Number(avgRatingRow.avg).toFixed(1)) : 0,
      totalRatings: avgRatingRow ? avgRatingRow.count : 0,
      byService
    };
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default new SQLiteAdapter();
