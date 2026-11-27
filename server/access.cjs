const { admin, confirm, login, page } = require('./pages.cjs');

const maxRoofLength = 12006;
const maxFormLength = 3 * maxRoofLength + 1024;
const cookieName = 'roof_session';
const roofPaths = new Set(['/', '/prototype', '/prototype/', '/prototype/index.html']);
const normalizeEmail = value => {
  const email = (value || '').trim().toLowerCase();
  return email.length <= 254 && /^[a-z0-9_+~-]+(?:\.[a-z0-9_+~-]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email) ? email : null;
};

function html(res, content, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(content);
}

function redirect(res, path) {
  res.writeHead(303, { Location: path });
  res.end();
}

async function form(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') return null;
  let body = '';
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > maxFormLength) return null;
    body += chunk;
  }
  return new URLSearchParams(body);
}

function createAccess({ origin, owner, store, send, viewer }) {
  const cookie = (value, age) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${origin.startsWith('https:') ? '; Secure' : ''}`;

  async function deliver(email, key, invite) {
    try {
      await send({ email, link: `${origin}/confirm#key=${key}`, invite });
      return true;
    } catch (error) {
      await store.discard(key);
      console.error('Ошибка доставки письма', error.code || error.name);
      return false;
    }
  }

  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    try {
      const url = new URL(req.url, origin);
      const path = url.pathname === '/api/access' ? '/' + (url.searchParams.get('route') || '') : url.pathname;
      const session = req.headers.cookie?.match(/(?:^|;\s*)roof_session=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (path === '/confirm') return html(res, confirm());
        if (path === '/login') return html(res, login(url.searchParams.has('sent') ? 'Если для этой почты открыт доступ, письмо придёт в течение нескольких минут.' : ''));
        if (roofPaths.has(path) || path === '/admin') {
          const email = await store.identify(session);
          if (!email) return redirect(res, '/login');
          if (path === '/admin') {
            if (email !== owner) return html(res, page('Доступ запрещён', '<p><a href="/">Вернуться к визуализатору</a></p>'), 403);
            return html(res, admin(await store.list()));
          }
          return html(res, viewer.replace('<!-- account-actions -->', `
            <details class="account-menu">
              <summary>Аккаунт</summary>
              <div>
                ${email === owner ? '<a href="/admin">Управление доступом</a>' : ''}
                <form method="post" action="/logout"><button>Выйти</button></form>
              </div>
            </details>`));
        }
      }
      if (req.method === 'POST') {
        if (req.headers.origin !== origin) return html(res, page('Запрос отклонён', ''), 403);
        const fields = await form(req);
        if (!fields) return html(res, page('Некорректный запрос', ''), 400);
        if (path === '/login') {
          const email = normalizeEmail(fields.get('email'));
          if (!email) return html(res, login('Проверьте адрес электронной почты.'), 400);
          const requestedRoof = fields.get('roof') || '';
          const roof = requestedRoof.length <= maxRoofLength && /^#roof=(?:[A-Za-z0-9_.!~*'()-]|%[a-fA-F0-9]{2})+$/.test(requestedRoof) ? requestedRoof : '';
          const key = await store.issue(email, roof);
          if (key) await deliver(email, key, false);
          return redirect(res, '/login?sent=1');
        }
        if (path === '/confirm') {
          const result = await store.redeem(fields.get('key'));
          if (!result) return html(res, login('Ссылка уже использована, отозвана или просрочена. Запросите новую.'), 400);
          res.setHeader('Set-Cookie', cookie(result.session, 30 * 86400));
          return redirect(res, '/' + result.roof);
        }
        if (path === '/logout') {
          await store.signOut(session);
          res.setHeader('Set-Cookie', cookie('', 0));
          return redirect(res, '/login');
        }
        if (path === '/admin/invite' || path === '/admin/revoke') {
          if (await store.identify(session) !== owner) return html(res, page('Доступ запрещён', ''), 403);
          const email = normalizeEmail(fields.get('email'));
          if (!email || email === owner) return html(res, admin(await store.list(), 'Укажите email получателя.'), 400);
          if (path === '/admin/revoke') {
            await store.revoke(email);
            return redirect(res, '/admin');
          }
          const key = await store.issue(email, '', true);
          if (!key) return html(res, admin(await store.list(), 'Письмо уже запрашивали. Повторите через минуту.'), 429);
          const sent = await deliver(email, key, true);
          return html(res, admin(await store.list(), sent ? 'Приглашение отправлено.' : 'Доступ выдан, но письмо не отправилось. Повторите отправку через минуту.'), sent ? 200 : 502);
        }
      }
      return html(res, page('Страница не найдена', '<p><a href="/">На главную</a></p>'), 404);
    } catch (error) {
      console.error('Ошибка сервера доступа', error.code || error.name);
      return html(res, page('Сервис временно недоступен', '<p>Попробуйте позже.</p>'), 503);
    }
  };
}

module.exports = { createAccess, normalizeEmail };
