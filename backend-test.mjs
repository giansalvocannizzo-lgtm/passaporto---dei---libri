import assert from 'node:assert/strict';
import fs from 'node:fs';

assert.ok(fs.existsSync('server.js'), 'server.js presente');
assert.ok(fs.existsSync('package.json'), 'package.json presente');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
assert.equal(pkg.scripts.start, 'node server.js');
assert.ok(pkg.dependencies.pg, 'pg presente');
const source = fs.readFileSync('server.js','utf8');
for (const route of ['/api/health','/api/auth/admin','/api/auth/member','/api/books','/api/members']) assert.ok(source.includes(route), `route ${route} presente`);
assert.ok(source.includes("UPDATE books SET status='in_giro'"), 'prestito atomico presente');
assert.ok(source.includes("AND status='disponibile'"), 'guardia disponibilità presente');
assert.ok(source.includes("AND holder_id=$2"), 'guardia restituzione presente');
console.log('V6 backend structural tests: OK');
