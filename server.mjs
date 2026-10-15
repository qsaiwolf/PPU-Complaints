/**
 * Palestine Polytechnic University (PPU) - Complaints System Server
 * Full-Stack Node.js & Express server with dual-storage (SQLite / MySQL) engine.
 */
import app from './server/app.js';
import { config } from './server/config/env.js';
import { getDatabaseAdapter, closeDatabaseConnection } from './server/database/connection.js';

async function bootstrap() {
  try {
    console.log('====================================================');
    console.log('🏛️  نظام الشكاوى — جامعة بوليتكنك فلسطين (PPU)');
    console.log('====================================================');

    // Initialize Database layer
    const adapter = await getDatabaseAdapter();

    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log(`🚀 الخادم الموحد (الواجهة الأمامية + الباك إند) يعمل بنجاح!`);
      console.log(`🌐 المنفذ النشط (Port): ${config.port} (0.0.0.0:${config.port})`);
      console.log(`📦 محرك قاعدة البيانات النشط: [${adapter.engineName.toUpperCase()}]`);
      console.log(`💻 الواجهة الرئيسية للطلبة: http://0.0.0.0:${config.port}/`);
      console.log(`👔 بوابة الإدارة والمشرفين: http://0.0.0.0:${config.port}/#admin`);
      console.log(`🔌 واجهة الـ API البرمجية: http://0.0.0.0:${config.port}/api/v1/health`);
      console.log(`🔑 بيانات الدخول الافتراضية: ${config.defaultAdmin.email} / ${config.defaultAdmin.password}`);
      console.log('====================================================');
    });

    server.on('error', error => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ المنفذ ${config.port} مستخدم حاليًا. يمكنك تغيير PORT في ملف .env أو تشغيل: PORT=8081 npm start`);
      } else {
        console.error('❌ خطأ في تشغيل السيرفر:', error.message);
      }
      process.exit(1);
    });

    // Graceful Shutdown
    const shutdown = async () => {
      console.log('\n🛑 جاري إيقاف الخادم بأمان...');
      server.close(async () => {
        await closeDatabaseConnection();
        console.log('✅ تم إغلاق اتصالات الخادم وقواعد البيانات بنجاح.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('❌ فشل في بدء تشغيل النظام:', error);
    process.exit(1);
  }
}

bootstrap();
