/**
 * Palestine Polytechnic University (PPU) - Complaints System
 * Unified Full-Stack Application Server (Frontend SPA + REST API Backend)
 * 
 * Single canonical entrypoint for local development, production, and Pterodactyl hosting.
 */
import fs from 'node:fs';
import path from 'node:path';
import app from './server/app.js';
import { config } from './server/config/env.js';
import { getDatabaseAdapter, closeDatabaseConnection } from './server/database/connection.js';

async function bootstrap() {
  try {
    // Ensure required storage directories exist
    const dataDir = path.dirname(config.sqlitePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }

    // Initialize Database layer (with auto-failover resilience)
    const adapter = await getDatabaseAdapter();

    // Start Unified HTTP Server
    const server = app.listen(config.port, '0.0.0.0', () => {
      console.log('================================================================================');
      console.log('  PALESTINE POLYTECHNIC UNIVERSITY (PPU) - COMPLAINTS SYSTEM');
      console.log('  Unified Server (Full-Stack Frontend SPA + Express REST API)');
      console.log('================================================================================');
      console.log(`  • Server Status  : Online & Ready`);
      console.log(`  • Network Host   : 0.0.0.0:${config.port} (Port: ${config.port})`);
      console.log(`  • Storage Engine : [${adapter.engineName.toUpperCase()}]`);
      console.log(`  • Student Portal : http://localhost:${config.port}/`);
      console.log(`  • Admin Portal   : http://localhost:${config.port}/#admin`);
      console.log(`  • API Health     : http://localhost:${config.port}/api/v1/health`);
      console.log(`  • Default Admin  : ${config.defaultAdmin.email} / ${config.defaultAdmin.password}`);
      console.log('================================================================================');
    });

    // Handle port conflicts gracefully
    server.on('error', error => {
      if (error.code === 'EADDRINUSE') {
        console.error(`[ERROR] Port ${config.port} is already in use by another process.`);
        console.error(`Hint: Set a different port in .env (e.g. PORT=8081) or run: PORT=8081 npm start`);
      } else {
        console.error(`[ERROR] Server startup failed:`, error.message);
      }
      process.exit(1);
    });

    // Graceful Shutdown on termination signals
    const handleShutdown = async (signal) => {
      console.log(`\n[INFO] Received ${signal}. Shutting down unified server gracefully...`);
      server.close(async () => {
        try {
          await closeDatabaseConnection();
          console.log('[INFO] Database connections closed. Process terminated cleanly.');
        } catch (err) {
          console.error('[ERROR] Error closing database connections:', err.message);
        }
        process.exit(0);
      });
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  } catch (err) {
    console.error('[FATAL] Failed to initialize server:', err.message);
    process.exit(1);
  }
}

bootstrap();
