const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { createStore } = require('../server/store.cjs');
const { createAccess } = require('../server/access.cjs');

test('email access protects the viewer and supports invitation, sign-in and revocation', async t => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(readFileSync(join(__dirname, '../server/schema.sql'), 'utf8'));
  const pool = {
    query: db.query.bind(db),
    async connect() {
      return { query: db.query.bind(db), release() {} };
    }
  };
  const owner = 'owner@example.test';
  const guest = 'guest@example.test';
  const messages = [];
  const store = createStore(pool, owner);
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  server.on('request', createAccess({
    origin, owner, store, viewer: '<canvas></canvas><!-- account-actions -->',
    async send(message) { messages.push(message); }
  }));

  const get = (path, cookie = '') => fetch(origin + path, { redirect: 'manual', headers: { cookie } });
  const post = (path, fields = {}, cookie = '', requestOrigin = origin) => fetch(origin + path, {
    method: 'POST', redirect: 'manual', headers: { cookie, origin: requestOrigin },
    body: new URLSearchParams(fields)
  });
  const key = () => new URL(messages.at(-1).link).hash.slice('#key='.length);
  const session = response => response.headers.get('set-cookie').split(';')[0];

  for (const path of ['/', '/prototype', '/prototype/', '/prototype/index.html', '/api/access', '/admin']) {
    const response = await get(path);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), '/login');
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal((await get('/prototype/_before.html')).status, 404);
  assert.equal((await post('/login', { email: guest })).headers.get('location'), '/login?sent=1');
  assert.equal(messages.length, 0);
  assert.equal((await post('/admin/invite', { email: guest })).status, 403);

  await post('/api/access?route=login', { email: owner.toUpperCase() });
  assert.equal(messages.at(-1).email, owner);
  assert.equal((await get('/confirm')).status, 200);
  const ownerResponse = await post('/confirm', { key: key() });
  assert.equal(ownerResponse.status, 303);
  assert.match(ownerResponse.headers.get('set-cookie'), /HttpOnly; SameSite=Lax/);
  const ownerCookie = session(ownerResponse);
  assert.equal((await post('/confirm', { key: key() })).status, 400);
  assert.equal((await post('/admin/invite', { email: guest }, ownerCookie, 'https://outside.test')).status, 403);

  const invitation = await post('/admin/invite', { email: guest }, ownerCookie);
  assert.equal(invitation.status, 200);
  assert.match(await invitation.text(), /Ожидает первого входа/);
  assert.equal(messages.at(-1).invite, true);
  assert.equal(messages.at(-1).email, guest);
  const guestResponse = await post('/confirm', { key: key() });
  assert.equal(guestResponse.status, 303);
  const guestCookie = session(guestResponse);
  assert.match(await (await get('/', guestCookie)).text(), /<canvas>/);
  assert.match(await (await get('/admin', ownerCookie)).text(), /Доступ активен/);
  assert.equal((await get('/admin', guestCookie)).status, 403);

  const roof = '#roof=' + encodeURIComponent(JSON.stringify({ v: 1, state: { type: 'shed' } }));
  await post('/login', { email: guest, roof });
  assert.equal(messages.length, 2, 'repeated mail is throttled');
  await db.query("UPDATE roof_accounts SET last_mail_at = now() - interval '2 minutes' WHERE email = $1", [guest]);
  await post('/login', { email: guest, roof });
  const returning = await post('/confirm', { key: key() });
  assert.equal(returning.headers.get('location'), '/' + roof);
  const returningCookie = session(returning);
  assert.equal((await post('/logout', {}, returningCookie)).status, 303);
  assert.equal((await get('/', returningCookie)).status, 303);
  assert.equal((await get('/', guestCookie)).status, 200);

  await db.query('UPDATE roof_accounts SET last_mail_at = NULL WHERE email = $1', [guest]);
  await post('/login', { email: guest });
  const expiredKey = key();
  await db.query("UPDATE roof_links SET expires_at = now() - interval '1 second' WHERE email = $1", [guest]);
  assert.equal((await post('/confirm', { key: expiredKey })).status, 400);

  await db.query('UPDATE roof_accounts SET last_mail_at = NULL WHERE email = $1', [guest]);
  await post('/login', { email: guest });
  const outstandingKey = key();
  assert.equal((await post('/admin/revoke', { email: guest }, ownerCookie)).status, 303);
  assert.equal((await get('/', guestCookie)).status, 303);
  assert.equal((await post('/confirm', { key: outstandingKey })).status, 400);
  assert.match(await (await get('/admin', ownerCookie)).text(), /Доступ отозван/);
});
