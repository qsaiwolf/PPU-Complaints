/**
 * MySQL Database Adapter
 * Production-ready MySQL connection pool adapter using mysql2/promise with parameterized queries.
 */
import mysql from 'mysql2/promise';
import { config } from '../config/env.js';
import { SERVICES } from '../config/constants.js';

class MySQLAdapter {
  constructor() {
    this.pool = null;
    this.engineName = 'mysql';
  }

  async init() {
    this.pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      waitForConnections: true,
      connectionLimit: config.mysql.connectionLimit,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    // Test connection
    const connection = await this.pool.getConnection();
    connection.release();

    await this.runMigrations();
  }

  async runMigrations() {
    const ddl = [
      `CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(30) PRIMARY KEY,
        name_ar VARCHAR(100) NOT NULL,
        icon VARCHAR(50) NOT NULL,
        description VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('super_admin', 'department_admin') NOT NULL DEFAULT 'department_admin',
        department_service_id VARCHAR(30) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS complaints (
        id VARCHAR(32) PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        student_id VARCHAR(50) NULL,
        email VARCHAR(100) NOT NULL,
        service_id VARCHAR(30) NOT NULL,
        location VARCHAR(150) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        status TINYINT NOT NULL DEFAULT 0,
        priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
        official_reply TEXT NULL,
        attachment_url VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_complaints_service (service_id),
        INDEX idx_complaints_status (status),
        INDEX idx_complaints_priority (priority),
        INDEX idx_complaints_created (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        complaint_id VARCHAR(32) NOT NULL UNIQUE,
        stars TINYINT NOT NULL,
        resolution ENUM('yes', 'partial', 'no') NOT NULL,
        comment TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS complaint_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        complaint_id VARCHAR(32) NOT NULL,
        old_status TINYINT NULL,
        new_status TINYINT NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        performed_by VARCHAR(100) NOT NULL,
        details TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_logs_complaint (complaint_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

      `CREATE TABLE IF NOT EXISTS internal_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        complaint_id VARCHAR(32) NOT NULL,
        admin_id INT NOT NULL,
        note TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notes_complaint (complaint_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
    ];

    for (const sql of ddl) {
      await this.pool.query(sql);
    }

    // Seed default services
    for (const service of SERVICES) {
      await this.pool.query(
        'INSERT IGNORE INTO services (id, name_ar, icon, description) VALUES (?, ?, ?, ?)',
        [service.id, service.name, service.icon, service.description]
      );
    }
  }

  async getServices() {
    const [rows] = await this.pool.query('SELECT * FROM services ORDER BY id ASC');
    return rows;
  }

  async findComplaintById(id) {
    const [rows] = await this.pool.query(`
      SELECT c.*, s.name_ar as service_name, s.icon as service_icon
      FROM complaints c
      LEFT JOIN services s ON c.service_id = s.id
      WHERE c.id = ?
    `, [id]);

    if (!rows.length) return null;
    const complaint = rows[0];

    const [ratings] = await this.pool.query('SELECT * FROM ratings WHERE complaint_id = ?', [id]);
    const [logs] = await this.pool.query('SELECT * FROM complaint_logs WHERE complaint_id = ? ORDER BY created_at ASC', [id]);
    const [notes] = await this.pool.query(`
      SELECT n.*, a.full_name as admin_name
      FROM internal_notes n
      LEFT JOIN admins a ON n.admin_id = a.id
      WHERE n.complaint_id = ?
      ORDER BY n.created_at ASC
    `, [id]);

    return {
      ...complaint,
      rating: ratings[0] || null,
      logs: logs || [],
      internalNotes: notes || []
    };
  }

  async createComplaint(data) {
    await this.pool.query(`
      INSERT INTO complaints (id, full_name, student_id, email, service_id, location, title, description, status, priority, official_reply, attachment_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '', ?, NOW(), NOW())
    `, [
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
    ]);

    await this.addAuditLog({
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

    const [rows] = await this.pool.query(sql, params);
    return rows;
  }

  async updateComplaintStatus(id, { status, officialReply, priority, performedBy }) {
    const existing = await this.findComplaintById(id);
    if (!existing) return null;

    const newStatus = status !== undefined ? Number(status) : existing.status;
    const newReply = officialReply !== undefined ? officialReply : existing.official_reply;
    const newPriority = priority !== undefined ? priority : existing.priority;

    await this.pool.query(`
      UPDATE complaints
      SET status = ?, official_reply = ?, priority = ?, updated_at = NOW()
      WHERE id = ?
    `, [newStatus, newReply, newPriority, id]);

    await this.addAuditLog({
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

    await this.pool.query(`
      INSERT INTO ratings (complaint_id, stars, resolution, comment, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `, [id, stars, resolution, comment || null]);

    await this.addAuditLog({
      complaintId: id,
      oldStatus: 3,
      newStatus: 3,
      actionType: 'RATING_ADDED',
      performedBy: complaint.full_name,
      details: `تم تقييم المعالجة بـ ${stars} نجوم (${resolution})`
    });

    const [rows] = await this.pool.query('SELECT * FROM ratings WHERE complaint_id = ?', [id]);
    return rows[0];
  }

  async getRating(id) {
    const [rows] = await this.pool.query('SELECT * FROM ratings WHERE complaint_id = ?', [id]);
    return rows[0] || null;
  }

  async addAuditLog({ complaintId, oldStatus, newStatus, actionType, performedBy, details }) {
    await this.pool.query(`
      INSERT INTO complaint_logs (complaint_id, old_status, new_status, action_type, performed_by, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [complaintId, oldStatus !== undefined ? oldStatus : null, newStatus, actionType, performedBy, details || null]);
  }

  async addInternalNote({ complaintId, adminId, note }) {
    await this.pool.query(`
      INSERT INTO internal_notes (complaint_id, admin_id, note, created_at)
      VALUES (?, ?, ?, NOW())
    `, [complaintId, adminId, note]);
  }

  async findAdminByEmail(email) {
    const [rows] = await this.pool.query('SELECT * FROM admins WHERE email = ?', [email]);
    return rows[0] || null;
  }

  async findAdminById(id) {
    const [rows] = await this.pool.query('SELECT id, full_name, email, role, department_service_id, created_at FROM admins WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async createAdmin({ fullName, email, passwordHash, role, departmentServiceId }) {
    const [result] = await this.pool.query(`
      INSERT INTO admins (full_name, email, password_hash, role, department_service_id, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [fullName, email, passwordHash, role || 'department_admin', departmentServiceId || null]);
    return this.findAdminById(result.insertId);
  }

  async getStats() {
    const [[{ count: total }]] = await this.pool.query('SELECT COUNT(*) as count FROM complaints');
    const [[{ count: pending }]] = await this.pool.query('SELECT COUNT(*) as count FROM complaints WHERE status = 0');
    const [[{ count: reviewing }]] = await this.pool.query('SELECT COUNT(*) as count FROM complaints WHERE status = 1');
    const [[{ count: processing }]] = await this.pool.query('SELECT COUNT(*) as count FROM complaints WHERE status = 2');
    const [[{ count: resolved }]] = await this.pool.query('SELECT COUNT(*) as count FROM complaints WHERE status = 3');

    const [[avgRow]] = await this.pool.query('SELECT AVG(stars) as avg, COUNT(*) as count FROM ratings');
    const [byService] = await this.pool.query(`
      SELECT s.id, s.name_ar, COUNT(c.id) as count
      FROM services s
      LEFT JOIN complaints c ON s.id = c.service_id
      GROUP BY s.id
      ORDER BY count DESC
    `);

    return {
      total,
      pending,
      reviewing,
      processing,
      resolved,
      averageRating: avgRow && avgRow.avg ? Number(Number(avgRow.avg).toFixed(1)) : 0,
      totalRatings: avgRow ? avgRow.count : 0,
      byService
    };
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

export default new MySQLAdapter();
