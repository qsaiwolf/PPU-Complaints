/**
 * Backend Automated Test Suite
 * Tests REST API endpoints, SQLite persistence, Admin Auth, and Ratings workflow.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../server/app.js';
import { getDatabaseAdapter, closeDatabaseConnection } from '../server/database/connection.js';

let server;
let baseUrl;
let adminToken;

before(async () => {
  // Ensure database is initialized
  await getDatabaseAdapter();

  // Start app on ephemeral port
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeDatabaseConnection();
});

test('Health check endpoint returns status ok and storage engine', async () => {
  const res = await fetch(`${baseUrl}/api/v1/health`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.status, 'ok');
  assert.ok(json.storageEngine);
});

test('Services endpoint lists valid university services', async () => {
  const res = await fetch(`${baseUrl}/api/v1/services`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(Array.isArray(json.data));
  assert.ok(json.data.length >= 6);
  assert.ok(json.data.some(s => s.id === 'internet'));
});

let createdComplaintId;

test('Student can submit a valid complaint and receives tracking ID', async () => {
  const payload = {
    fullName: 'أحمد التميمي',
    major: 'هندسة حاسوب',
    studentId: '202310123',
    email: 'ahmad@ppu.edu.ps',
    service: 'internet',
    location: 'مبنى C — قاعة C201',
    title: 'انقطاع شبكة الواي فاي',
    description: 'الشبكة تفصل باستمرار في هذه القاعة أثناء المحاضرة.'
  };

  const res = await fetch(`${baseUrl}/api/v1/complaints`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data.id.startsWith('PPU-'));
  assert.equal(json.data.status, 0);
  createdComplaintId = json.data.id;
});

test('Student can track complaint and view details', async () => {
  const res = await fetch(`${baseUrl}/api/v1/complaints/${createdComplaintId}`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.id, createdComplaintId);
  assert.equal(json.data.fullName, 'أحمد التميمي');
  assert.equal(json.data.status, 0);
  assert.ok(Array.isArray(json.data.logs));
  assert.equal(json.data.logs.length, 1);
});

test('Cannot rate a complaint before it is resolved (status must be 3)', async () => {
  const res = await fetch(`${baseUrl}/api/v1/complaints/${createdComplaintId}/rating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stars: 5, resolution: 'yes', comment: 'رائع' })
  });

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.success, false);
  assert.ok(json.message.includes('بعد حلّها'));
});

test('Admin can log in with default credentials and receives JWT token', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@ppu.edu.ps',
      password: 'adminPPU2026!'
    })
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data.token);
  assert.equal(json.data.admin.email, 'admin@ppu.edu.ps');
  adminToken = json.data.token;
});

test('Admin login fails with invalid password', async () => {
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@ppu.edu.ps',
      password: 'WrongPassword123'
    })
  });

  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.success, false);
});

test('Admin can update complaint status to Resolved (3) with official reply', async () => {
  const res = await fetch(`${baseUrl}/api/v1/admin/complaints/${createdComplaintId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      status: 3,
      officialReply: 'تم فحص نقطة الوصول في القاعة C201 واستبدال كابل الشبكة التالف.',
      priority: 'high'
    })
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.status, 3);
  assert.ok(json.data.official_reply.includes('استبدال كابل'));
});

test('Student can now rate the resolved complaint', async () => {
  const res = await fetch(`${baseUrl}/api/v1/complaints/${createdComplaintId}/rating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stars: 5,
      resolution: 'yes',
      comment: 'شكراً جزيلاً لسرعة الاستجابة.'
    })
  });

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.stars, 5);
});

test('Student cannot rate the same complaint twice', async () => {
  const res = await fetch(`${baseUrl}/api/v1/complaints/${createdComplaintId}/rating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stars: 1,
      resolution: 'no'
    })
  });

  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.success, false);
  assert.ok(json.message.includes('سبق حفظ'));
});

test('Admin can fetch dashboard statistics', async () => {
  const res = await fetch(`${baseUrl}/api/v1/admin/stats`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.ok(json.data.total >= 1);
  assert.ok(json.data.resolved >= 1);
  assert.ok(json.data.averageRating >= 1);
});

test('Admin can export complaints to CSV with UTF-8 BOM', async () => {
  const res = await fetch(`${baseUrl}/api/v1/admin/export`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('text/csv'));
  const buffer = Buffer.from(await res.arrayBuffer());
  assert.equal(buffer[0], 0xEF);
  assert.equal(buffer[1], 0xBB);
  assert.equal(buffer[2], 0xBF);
  const text = buffer.toString('utf8');
  assert.ok(text.includes('رقم الشكوى'));
  assert.ok(text.includes(createdComplaintId));
});

test('Database cleanup: removes temporary test complaint from database', async () => {
  if (createdComplaintId) {
    const adapter = await getDatabaseAdapter();
    if (adapter.engineName === 'sqlite' && adapter.db) {
      adapter.db.prepare('DELETE FROM ratings WHERE complaint_id = ?').run(createdComplaintId);
      adapter.db.prepare('DELETE FROM internal_notes WHERE complaint_id = ?').run(createdComplaintId);
      adapter.db.prepare('DELETE FROM complaint_logs WHERE complaint_id = ?').run(createdComplaintId);
      adapter.db.prepare('DELETE FROM complaints WHERE id = ?').run(createdComplaintId);
    }
  }
});
