const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Pool } = require('pg');
const { attachDatabasePool } = require('@vercel/functions');
const nodemailer = require('nodemailer');
const { createAccess, normalizeEmail } = require('../server/access.cjs');
const { createStore } = require('../server/store.cjs');

let access;

module.exports = (req, res) => {
  if (!access) {
    try {
      const { APP_URL, OWNER_EMAIL, DATABASE_URL, SMTP_URL, MAIL_FROM } = process.env;
      const owner = normalizeEmail(OWNER_EMAIL);
      const app = new URL(APP_URL);
      const origin = app.origin;
      const smtp = new URL(SMTP_URL);
      if (!owner || !DATABASE_URL || !['smtp:', 'smtps:'].includes(smtp.protocol) || !MAIL_FROM || app.href !== origin + '/' ||
          (app.protocol !== 'https:' && !(app.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(app.hostname)))) {
        throw new Error('Invalid access configuration');
      }
      const viewer = readFileSync(resolve(__dirname, '../prototype/index.html'), 'utf8');
      const secure = smtp.protocol === 'smtps:';
      const mailer = nodemailer.createTransport({
        host: smtp.hostname,
        port: Number(smtp.port || (secure ? 465 : 587)),
        secure,
        requireTLS: !secure,
        auth: smtp.username ? {
          user: decodeURIComponent(smtp.username),
          pass: decodeURIComponent(smtp.password)
        } : undefined,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        disableFileAccess: true,
        disableUrlAccess: true
      });
      const pool = new Pool({ connectionString: DATABASE_URL, max: 3, connectionTimeoutMillis: 5000 });
      if (process.env.VERCEL === '1') attachDatabasePool(pool);
      pool.on('error', error => console.error('Ошибка подключения к БД', error.code || error.name));
      access = createAccess({
        origin, owner, viewer, store: createStore(pool, owner),
        async send({ email, link, invite }) {
          const info = await mailer.sendMail({
            from: MAIL_FROM, to: [{ address: email, name: '' }],
            subject: invite ? 'Приглашение в визуализатор кровли' : 'Вход в визуализатор кровли',
            text: `Откройте ссылку и подтвердите вход. Ссылка действует ${invite ? '48 часов' : '15 минут'} и используется один раз.\n\n${link}`
          });
          if (!info.accepted.length) throw new Error('Mail not accepted');
        }
      });
    } catch {
      res.writeHead(503, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Сервис доступа пока не настроен.');
      return;
    }
  }
  return access(req, res);
};
