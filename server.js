import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const PORT = Number(process.env.PORT || 10000);
const DATABASE_URL = process.env.DATABASE_URL;
const AUTH_SECRET = process.env.AUTH_SECRET || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (IS_PRODUCTION && (!DATABASE_URL || !AUTH_SECRET || !ADMIN_PASSWORD)) {
  console.error('Missing DATABASE_URL, AUTH_SECRET or ADMIN_PASSWORD in production');
  process.exit(1);
}

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false } }) : null;

const send = (res, status, body, headers = {}) => { const payload = JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': CORS_ORIGIN, 'access-control-allow-headers': 'Content-Type, Authorization', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'vary': 'Origin', ...headers }); res.end(payload); };
const text = (res, status, body, headers = {}) => { res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': CORS_ORIGIN, 'access-control-allow-headers': 'Content-Type, Authorization', 'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS', 'vary': 'Origin', ...headers }); res.end(body); };
const ok = (res, body = {}) => send(res, 200, body);
const created = (res, body = {}) => send(res, 201, body);
const bad = (res, message) => send(res, 400, { error: message });
const unauthorized = (res) => send(res, 401, { error: 'Autenticazione richiesta' });
const forbidden = (res) => send(res, 403, { error: 'Permessi insufficienti' });
const notFound = (res) => send(res, 404, { error: 'Risorsa non trovata' });

async function body(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); if (!chunks.length) return {}; try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { const error = new Error('JSON non valido'); error.statusCode = 400; throw error; } }
function b64url(input) { return Buffer.from(input).toString('base64url'); }
function signToken(payload) { const data = b64url(JSON.stringify(payload)); const sig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url'); return `${data}.${sig}`; }
function verifyToken(token) { try { if (!AUTH_SECRET || !token) return null; const [data, sig] = token.split('.'); if (!data || !sig) return null; const expected = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url'); if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null; const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); if (!payload.exp || payload.exp < Date.now()) return null; return payload; } catch { return null; } }
function auth(req) { const value = req.headers.authorization || ''; return verifyToken(value.startsWith('Bearer ') ? value.slice(7) : ''); }
function requireRole(req, res, role) { const user = auth(req); if (!user) { unauthorized(res); return null; } if (role && user.role !== role && user.role !== 'admin') { forbidden(res); return null; } return user; }
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

async function initDb() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, email TEXT, pin_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, title TEXT NOT NULL, author TEXT, isbn TEXT, genre TEXT,
      description TEXT, cover_image TEXT, owner_id TEXT REFERENCES members(id),
      status TEXT NOT NULL DEFAULT 'disponibile' CHECK (status IN ('disponibile','in_giro')),
      holder_id TEXT REFERENCES members(id), position TEXT, expected_return_date DATE,
      revision INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS book_events (
      id BIGSERIAL PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      member_id TEXT REFERENCES members(id), type TEXT NOT NULL CHECK (type IN ('prestito','restituzione','posizione','traccia','creazione')),
      note TEXT, position TEXT, expected_return_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
    CREATE INDEX IF NOT EXISTS idx_events_book ON book_events(book_id, created_at DESC);
  `);
}
function mapMember(r) { return { id:r.id, code:r.code, name:r.name, email:r.email, createdAt:r.created_at, updatedAt:r.updated_at }; }
function mapBook(r) { return { id:r.id, code:r.code, title:r.title, author:r.author, isbn:r.isbn, genre:r.genre, description:r.description, coverImage:r.cover_image, ownerId:r.owner_id, status:r.status, holderId:r.holder_id, position:r.position, expectedReturnDate:r.expected_return_date, revision:r.revision, createdAt:r.created_at, updatedAt:r.updated_at }; }

async function routes(req, res, url) {
  if (url.pathname === '/api/health' && req.method === 'GET') return ok(res, { ok:true, service:'passaporto-api', database:!!pool, version:'6.0.0' });
  if (url.pathname === '/api/auth/admin' && req.method === 'POST') { const input=await body(req); if (!ADMIN_PASSWORD || !input.password || hash(input.password)!==hash(ADMIN_PASSWORD)) return unauthorized(res); return ok(res,{token:signToken({role:'admin',exp:Date.now()+8*60*60*1000})}); }
  if (url.pathname === '/api/auth/member' && req.method === 'POST') { if(!pool)return send(res,503,{error:'Database non configurato'}); const input=await body(req); const {rows}=await pool.query('SELECT * FROM members WHERE code=$1',[String(input.code||'').trim()]); const member=rows[0]; if(!member||!member.pin_hash||hash(input.pin||'')!==member.pin_hash)return unauthorized(res); return ok(res,{token:signToken({role:'member',memberId:member.id,exp:Date.now()+30*24*60*60*1000}),member:mapMember(member)}); }
  if (!pool) return send(res,503,{error:'Database non configurato'});

  if (url.pathname === '/api/members' && req.method === 'GET') { const user=requireRole(req,res,'admin');if(!user)return;const {rows}=await pool.query('SELECT * FROM members ORDER BY name');return ok(res,{members:rows.map(mapMember)}); }
  if (url.pathname === '/api/members' && req.method === 'POST') { const user=requireRole(req,res,'admin');if(!user)return;const input=await body(req);if(!input.name||!input.code||!input.pin)return bad(res,'name, code e pin sono obbligatori');const id=crypto.randomUUID();try{const {rows}=await pool.query('INSERT INTO members(id,code,name,email,pin_hash) VALUES($1,$2,$3,$4,$5) RETURNING *',[id,String(input.code).trim(),String(input.name).trim(),input.email||null,hash(input.pin)]);return created(res,{member:mapMember(rows[0])});}catch(e){return send(res,409,{error:e.code==='23505'?'Codice socio già esistente':'Impossibile creare il socio'});} }

  if (url.pathname === '/api/books' && req.method === 'GET') { const q=String(url.searchParams.get('q')||'').trim();const values=[];let where='';if(q){values.push(`%${q}%`);where='WHERE title ILIKE $1 OR author ILIKE $1 OR isbn ILIKE $1 OR code ILIKE $1';}const {rows}=await pool.query(`SELECT * FROM books ${where} ORDER BY updated_at DESC`,values);return ok(res,{books:rows.map(mapBook)}); }
  if (url.pathname === '/api/books' && req.method === 'POST') { const user=requireRole(req,res,'admin');if(!user)return;const input=await body(req);if(!input.title)return bad(res,'Il titolo è obbligatorio');const id=crypto.randomUUID();const code=input.code||`PB-${Date.now().toString().slice(-6)}`;const client=await pool.connect();try{await client.query('BEGIN');const {rows}=await client.query('INSERT INTO books(id,code,title,author,isbn,genre,description,cover_image,owner_id,position) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[id,code,input.title,input.author||null,input.isbn||null,input.genre||null,input.description||null,input.coverImage||null,input.ownerId||null,input.position||null]);await client.query('INSERT INTO book_events(book_id,type,note) VALUES($1,$2,$3)',[id,'creazione','Libro inserito nell’archivio']);await client.query('COMMIT');return created(res,{book:mapBook(rows[0])});}catch(e){await client.query('ROLLBACK');return send(res,409,{error:e.code==='23505'?'Codice libro già esistente':'Impossibile creare il libro'});}finally{client.release();} }

  const bookMatch=url.pathname.match(/^\/api\/books\/([^/]+)(?:\/(borrow|return|position|trace|events))?$/);
  if(bookMatch){const id=decodeURIComponent(bookMatch[1]);const action=bookMatch[2];
    if(req.method==='GET'&&!action){const {rows}=await pool.query('SELECT * FROM books WHERE id=$1 OR code=$1',[id]);if(!rows[0])return notFound(res);const ev=await pool.query('SELECT * FROM book_events WHERE book_id=$1 ORDER BY created_at DESC',[rows[0].id]);return ok(res,{book:mapBook(rows[0]),events:ev.rows});}
    if(req.method==='PATCH'&&!action){const user=requireRole(req,res,'admin');if(!user)return;const input=await body(req);const fields=[['title','title'],['author','author'],['isbn','isbn'],['genre','genre'],['description','description'],['coverImage','cover_image'],['position','position'],['expectedReturnDate','expected_return_date']];const sets=[];const vals=[];for(const [f,col] of fields){if(Object.prototype.hasOwnProperty.call(input,f)){sets.push(`${col}=$${vals.length+1}`);vals.push(input[f]||null);}}if(!sets.length)return bad(res,'Nessun campo da aggiornare');vals.push(id);const {rows}=await pool.query(`UPDATE books SET ${sets.join(', ')}, revision=revision+1, updated_at=now() WHERE id=$${vals.length} RETURNING *`,vals);if(!rows[0])return notFound(res);return ok(res,{book:mapBook(rows[0])});}
    if(req.method==='POST'&&action==='borrow'){const user=requireRole(req,res,'member');if(!user)return;const input=await body(req);const client=await pool.connect();try{await client.query('BEGIN');const q=await client.query(`UPDATE books SET status='in_giro',holder_id=$1,position=$2,expected_return_date=$3,revision=revision+1,updated_at=now() WHERE id=$4 AND status='disponibile' RETURNING *`,[user.memberId,input.position||null,input.expectedReturnDate||null,id]);if(!q.rows[0]){await client.query('ROLLBACK');return send(res,409,{error:'Il libro non è più disponibile'});}await client.query('INSERT INTO book_events(book_id,member_id,type,note,position,expected_return_date) VALUES($1,$2,$3,$4,$5,$6)',[id,user.memberId,'prestito',input.note||null,input.position||null,input.expectedReturnDate||null]);await client.query('COMMIT');return ok(res,{book:mapBook(q.rows[0])});}catch(e){await client.query('ROLLBACK');return send(res,500,{error:'Errore nel prestito'});}finally{client.release();}}
    if(req.method==='POST'&&action==='return'){const user=requireRole(req,res,'member');if(!user)return;const client=await pool.connect();try{await client.query('BEGIN');const q=await client.query(`UPDATE books SET status='disponibile',holder_id=NULL,position=NULL,expected_return_date=NULL,revision=revision+1,updated_at=now() WHERE id=$1 AND status='in_giro' AND holder_id=$2 RETURNING *`,[id,user.memberId]);if(!q.rows[0]){await client.query('ROLLBACK');return send(res,409,{error:'Il libro non risulta in tuo possesso'});}await client.query('INSERT INTO book_events(book_id,member_id,type) VALUES($1,$2,$3)',[id,user.memberId,'restituzione']);await client.query('COMMIT');return ok(res,{book:mapBook(q.rows[0])});}catch(e){await client.query('ROLLBACK');return send(res,500,{error:'Errore nella restituzione'});}finally{client.release();}}
    if(req.method==='POST'&&(action==='position'||action==='trace')){const user=requireRole(req,res,'member');if(!user)return;const input=await body(req);const type=action==='position'?'posizione':'traccia';const q=await pool.query(`UPDATE books SET position=$1,revision=revision+1,updated_at=now() WHERE id=$2 AND holder_id=$3 RETURNING *`,[input.position||null,id,user.memberId]);if(!q.rows[0])return send(res,409,{error:'Solo il socio che ha il libro può aggiornarne la posizione'});await pool.query('INSERT INTO book_events(book_id,member_id,type,note,position) VALUES($1,$2,$3,$4,$5)',[id,user.memberId,type,input.note||null,input.position||null]);return ok(res,{book:mapBook(q.rows[0])});}
    if(req.method==='GET'&&action==='events'){const user=requireRole(req,res,'member');if(!user)return;const {rows}=await pool.query('SELECT * FROM book_events WHERE book_id=$1 ORDER BY created_at DESC',[id]);return ok(res,{events:rows});}
  }
  return notFound(res);
}

const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':CORS_ORIGIN,'access-control-allow-headers':'Content-Type, Authorization','access-control-allow-methods':'GET,POST,PATCH,OPTIONS','vary':'Origin'});return res.end();}if(url.pathname.startsWith('/api/'))return await routes(req,res,url);return text(res,404,'Passaporto dei Libri API — endpoint non trovato');}catch(e){console.error(e);return send(res,e.statusCode||500,{error:e.message||'Errore interno'});}});

initDb().then(()=>server.listen(PORT,()=>console.log(`Passaporto API listening on ${PORT}`))).catch(e=>{console.error('Database init failed',e);process.exit(1)});
