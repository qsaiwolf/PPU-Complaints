/**
 * Central Database Connection Manager & Factory.
 * Manages dual engine loading (SQLite / MySQL) with smart Auto-Failover and Admin Auto-Seeding.
 */
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';
import sqliteAdapter from './sqlite-adapter.js';
import mysqlAdapter from './mysql-adapter.js';

let activeAdapter = null;

export async function getDatabaseAdapter() {
  if (activeAdapter) return activeAdapter;

  const requestedEngine = (config.storageEngine || 'sqlite').toLowerCase();

  if (requestedEngine === 'mysql') {
    try {
      console.log('🔄 جاري محاولة الاتصال بقاعدة بيانات MySQL...');
      await mysqlAdapter.init();
      activeAdapter = mysqlAdapter;
      console.log('✅ تم الاتصال بنجاح بقاعدة بيانات MySQL');
    } catch (error) {
      console.warn(`⚠️ تعذر الاتصال بـ MySQL (${error.message})`);
      console.warn('🔄 التحويل التلقائي الذكي (Auto-Failover) إلى قاعدة بيانات SQLite المحلية...');
      await sqliteAdapter.init();
      activeAdapter = sqliteAdapter;
      console.log('✅ تم تفعيل محرك SQLite المحلي بنجاح (./data/ppu_complaints.db)');
    }
  } else {
    // Default: SQLite local engine
    await sqliteAdapter.init();
    activeAdapter = sqliteAdapter;
    console.log('✅ تم تفعيل محرك SQLite المحلي بنجاح (./data/ppu_complaints.db)');
  }

  // Auto-seed default Super Admin if none exists
  await seedDefaultAdmin(activeAdapter);

  return activeAdapter;
}

async function seedDefaultAdmin(adapter) {
  try {
    const existing = await adapter.findAdminByEmail(config.defaultAdmin.email);
    if (!existing) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(config.defaultAdmin.password, salt);
      await adapter.createAdmin({
        fullName: config.defaultAdmin.name,
        email: config.defaultAdmin.email,
        passwordHash,
        role: 'super_admin'
      });
      console.log(`👤 تم تهيئة حساب المشرف الافتراضي تلقائياً: [${config.defaultAdmin.email}]`);
    }
  } catch (err) {
    console.error('Failed to seed default admin:', err.message);
  }
}

export async function closeDatabaseConnection() {
  if (activeAdapter) {
    await activeAdapter.close();
    activeAdapter = null;
  }
}
