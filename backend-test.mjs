import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';

const BASE = `http://127.0.0.1:${process.env.TEST_PORT || 18080}`;
const SECRET = process.env.AUTH_SECRET || 'test-auth-secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-admin-password';

function token(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  let body = null;
  try { body = await response.json(); } catch {}
  return { status: response.status, body, headers: response.headers };
}

async function waitForHealth() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const r = await request('/api/health');
      if (r.status === 200) return r;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Backend non disponibile entro il timeout');
}

function startServer(extraEnv = {}) {
  return spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(process.env.TEST_PORT || 18080), NODE_ENV: 'test', AUTH_SECRET: SECRET, ADMIN_PASSWORD, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  server.kill('SIGTERM');
  await new Promise(resolve => { const timer = setTimeout(resolve, 2000); server.once('exit', () => { clearTimeout(timer); resolve(); }); });
}

function assertNoSecrets(value) {
  const json = JSON.stringify(value);
  assert.equal(json.includes('pin_hash'), false, 'pin_hash non deve uscire dalle API');
  assert.equal(json.includes('ADMIN_PASSWORD'), false, 'ADMIN_PASSWORD non deve uscire dalle API');
  assert.equal(json.includes('AUTH_SECRET'), false, 'AUTH_SECRET non deve uscire dalle API');
}

const server = startServer({ DATABASE_URL: process.env.DATABASE_URL, DB_SSL: process.env.DB_SSL || 'false' });
try {
  const health = await waitForHealth();
  assert.equal(health.body.ok, true);
  assert.equal(health.body.database, true);
  assert.equal(health.headers.get('access-control-allow-origin'), '*');

  const adminLogin = await request('/api/auth/admin', { method: 'POST', body: JSON.stringify({ password: ADMIN_PASSWORD }) });
  assert.equal(adminLogin.status, 200, 'autenticazione admin');
  const adminToken = adminLogin.body.token;
  assert.ok(adminToken);

  assert.equal((await request('/api/members', { headers: { authorization: 'Bearer malformed' } })).status, 401, 'token malformato -> 401');
  const expired = token({ role: 'admin', exp: Date.now() - 1000 });
  assert.equal((await request('/api/members', { headers: { authorization: `Bearer ${expired}` } })).status, 401, 'token scaduto -> 401');
  assert.equal((await request('/api/members', { headers: { authorization: `Bearer ${token({ role: 'member', memberId: 'nope', exp: Date.now() + 60000 })}` } })).status, 403, 'member non può creare/listare soci');

  const suffix = crypto.randomUUID().slice(0, 8);
  const member1Create = await request('/api/members', { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ code: `T1-${suffix}`, name: 'Test Uno', email: `uno-${suffix}@example.test`, pin: '1111' }) });
  assert.equal(member1Create.status, 201, 'creazione socio 1');
  assertNoSecrets(member1Create.body);
  const member2Create = await request('/api/members', { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ code: `T2-${suffix}`, name: 'Test Due', email: `due-${suffix}@example.test`, pin: '2222' }) });
  assert.equal(member2Create.status, 201, 'creazione socio 2');
  assertNoSecrets(member2Create.body);
  const member1 = member1Create.body.member;
  const member2 = member2Create.body.member;

  const member1Login = await request('/api/auth/member', { method: 'POST', body: JSON.stringify({ code: member1.code, pin: '1111' }) });
  assert.equal(member1Login.status, 200, 'autenticazione socio 1');
  assertNoSecrets(member1Login.body);
  const member2Login = await request('/api/auth/member', { method: 'POST', body: JSON.stringify({ code: member2.code, pin: '2222' }) });
  assert.equal(member2Login.status, 200, 'autenticazione socio 2');
  const member1Token = member1Login.body.token;
  const member2Token = member2Login.body.token;

  const book = await request('/api/books', { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ code: `B-${suffix}`, title: `Libro test ${suffix}`, author: 'Autore Test', isbn: `ISBN-${suffix}`, genre: 'Test' }) });
  assert.equal(book.status, 201, 'creazione libro');
  assertNoSecrets(book.body);
  const bookId = book.body.book.id;

  const readBook = await request(`/api/books/${bookId}`, { headers: { authorization: `Bearer ${member1Token}` } });
  assert.equal(readBook.status, 200, 'lettura libro');
  assert.equal(readBook.body.book.id, bookId);
  assertNoSecrets(readBook.body);
  const search = await request(`/api/books?q=${encodeURIComponent(`Libro test ${suffix}`)}`);
  assert.equal(search.status, 200, 'ricerca libri');
  assert.ok(search.body.books.some(b => b.id === bookId));

  const malformed = await request('/api/members', { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: '{' });
  assert.equal(malformed.status, 400, 'JSON malformato -> 400');

  const differentBook1 = await request('/api/books', { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ code: `D1-${suffix}`, title: `Differente Uno ${suffix}` }) });
  const differentBook2 = await request('/api/books', { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ code: `D2-${suffix}`, title: `Differente Due ${suffix}` }) });
  assert.equal(differentBook1.status, 201);
  assert.equal(differentBook2.status, 201);

  const concurrentBook = await request('/api/books', { method: 'POST', headers: { authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ code: `C-${suffix}`, title: `Contesa ${suffix}` }) });
  assert.equal(concurrentBook.status, 201);
  const contestedId = concurrentBook.body.book.id;

  const [race1, race2] = await Promise.all([
    request(`/api/books/${contestedId}/borrow`, { method: 'POST', headers: { authorization: `Bearer ${member1Token}` }, body: JSON.stringify({ position: 'Catania' }) }),
    request(`/api/books/${contestedId}/borrow`, { method: 'POST', headers: { authorization: `Bearer ${member2Token}` }, body: JSON.stringify({ position: 'Ragusa' }) }),
  ]);
  const raceStatuses = [race1.status, race2.status].sort((a, b) => a - b);
  assert.deepEqual(raceStatuses, [200, 409], 'contesa sullo stesso libro: un solo successo e un 409');
  const contestedRead = await request(`/api/books/${contestedId}`, { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(contestedRead.body.book.status, 'in_giro');
  assert.ok([member1.id, member2.id].includes(contestedRead.body.book.holderId));
  const contestedEvents = contestedRead.body.events.filter(e => e.type === 'prestito');
  assert.equal(contestedEvents.length, 1, 'un solo evento di prestito valido');

  const holderToken = contestedRead.body.book.holderId === member1.id ? member1Token : member2Token;
  const otherToken = contestedRead.body.book.holderId === member1.id ? member2Token : member1Token;
  const wrongReturn = await request(`/api/books/${contestedId}/return`, { method: 'POST', headers: { authorization: `Bearer ${otherToken}` }, body: '{}' });
  assert.equal(wrongReturn.status, 409, 'restituzione da socio diverso dal custode -> 409');
  const position = await request(`/api/books/${contestedId}/position`, { method: 'POST', headers: { authorization: `Bearer ${holderToken}` }, body: JSON.stringify({ position: 'Modica' }) });
  assert.equal(position.status, 200, 'aggiornamento posizione');
  const trace = await request(`/api/books/${contestedId}/trace`, { method: 'POST', headers: { authorization: `Bearer ${holderToken}` }, body: JSON.stringify({ position: 'Scicli', note: 'Traccia test' }) });
  assert.equal(trace.status, 200, 'aggiornamento traccia');
  const eventsAuth = await request(`/api/books/${contestedId}/events`, { headers: { authorization: `Bearer ${holderToken}` } });
  assert.equal(eventsAuth.status, 200, 'eventi del libro autorizzati');
  assert.ok(eventsAuth.body.events.some(e => e.type === 'posizione'));
  assert.ok(eventsAuth.body.events.some(e => e.type === 'traccia'));
  const returned = await request(`/api/books/${contestedId}/return`, { method: 'POST', headers: { authorization: `Bearer ${holderToken}` }, body: '{}' });
  assert.equal(returned.status, 200, 'restituzione');
  assert.equal(returned.body.book.holderId, null);

  const [different1, different2] = await Promise.all([
    request(`/api/books/${differentBook1.body.book.id}/borrow`, { method: 'POST', headers: { authorization: `Bearer ${member1Token}` }, body: JSON.stringify({ position: 'A' }) }),
    request(`/api/books/${differentBook2.body.book.id}/borrow`, { method: 'POST', headers: { authorization: `Bearer ${member2Token}` }, body: JSON.stringify({ position: 'B' }) }),
  ]);
  assert.equal(different1.status, 200, 'prestito concorrente libro differente 1');
  assert.equal(different2.status, 200, 'prestito concorrente libro differente 2');

  const adminMembers = await request('/api/members', { headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(adminMembers.status, 200, 'accesso admin ai soci');
  assert.equal(adminMembers.body.members.length >= 2, true);
  assertNoSecrets(adminMembers.body);

  console.log('V6 backend integration/concurrency/security tests: OK');
} finally {
  await stopServer(server);
}

const noDbServer = startServer({ DATABASE_URL: undefined });
try {
  const health = await waitForHealth();
  assert.equal(health.body.database, false, 'health senza DATABASE_URL');
  const admin = await request('/api/auth/admin', { method: 'POST', body: JSON.stringify({ password: ADMIN_PASSWORD }) });
  assert.equal(admin.status, 200, 'admin auth senza database');
  const memberAuth = await request('/api/auth/member', { method: 'POST', body: JSON.stringify({ code: 'NONE', pin: 'NONE' }) });
  assert.equal(memberAuth.status, 503, 'member auth senza database -> 503');
  const members = await request('/api/members', { headers: { authorization: `Bearer ${admin.body.token}` } });
  assert.equal(members.status, 503, 'endpoint DB senza database -> 503');
  console.log('V6 no-DATABASE_URL behavior: OK');
} finally {
  await stopServer(noDbServer);
}
