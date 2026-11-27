function escape(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, char => entities[char]);
}

function page(title, content) {
  return `<!doctype html>
<html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · Примерка кровли 3D</title>
<style>
  *{box-sizing:border-box} body{margin:0;background:#eff2f3;color:#172829;font:16px/1.5 system-ui,sans-serif}
  main{max-width:42rem;margin:clamp(1rem,8vw,5rem) auto;padding:clamp(1rem,4vw,2rem);background:#fff;border:1px solid #dce2e3;border-radius:1rem}
  h1{line-height:1.1} label{display:block;margin-bottom:.4rem}
  input,button{font:inherit;padding:.65rem .85rem;border-radius:.5rem;border:1px solid #657a7b}
  input[type=email]{width:100%;max-width:25rem} button{background:#174b47;color:#fff;cursor:pointer;margin-top:.5rem}
  a{color:#174b47} ul{padding:0;list-style:none} li{padding:.7rem 0;border-top:1px solid #e0e5e6;overflow-wrap:anywhere}
  li form{display:inline} small{display:block;color:#465857} .notice{background:#edf5f4;padding:.8rem;border-radius:.5rem}
</style>
<main><h1>${escape(title)}</h1>${content}</main></html>`;
}

function login(message = '') {
  return page('Вход в визуализатор', `
    <p>Введите email, на который вам выдали доступ.</p>
    ${message ? `<p class="notice" role="status">${escape(message)}</p>` : ''}
    <form method="post" action="/login">
      <label for="email">Электронная почта</label>
      <input id="email" name="email" type="email" autocomplete="email" maxlength="254" required>
      <input type="hidden" name="roof" id="roof">
      <button>Получить ссылку для входа</button>
    </form>
    <script>
      if (location.hash.startsWith('#roof=')) document.getElementById('roof').value = location.hash;
    </script>`);
}

function confirm() {
  return page('Подтвердите вход', `
    <form method="post" action="/confirm">
      <input type="hidden" name="key" id="key">
      <button id="enter" disabled>Открыть визуализатор</button>
    </form>
    <p><a href="/login">Запросить новую ссылку</a></p>
    <script>
      const match = /^#key=([A-Za-z0-9_-]{43})$/.exec(location.hash);
      if (match) {
        document.getElementById('key').value = match[1];
        document.getElementById('enter').disabled = false;
        history.replaceState(null, '', location.pathname);
      }
    </script>`);
}

function admin(accounts, message = '') {
  const list = accounts.map(({ email, granted, accepted_at }) => `
    <li><strong>${escape(email)}</strong>
      <small>${granted ? (accepted_at ? 'Доступ активен' : 'Ожидает первого входа') : 'Доступ отозван'}</small>
      ${granted ? `<form method="post" action="/admin/revoke">
        <input type="hidden" name="email" value="${escape(email)}">
        <button>Отозвать доступ</button>
      </form>` : ''}
    </li>`).join('');
  return page('Управление доступом', `
    <p><a href="/">Открыть визуализатор</a></p>
    ${message ? `<p class="notice" role="status">${escape(message)}</p>` : ''}
    <form method="post" action="/admin/invite">
      <label for="email">Email получателя</label>
      <input id="email" name="email" type="email" autocomplete="off" maxlength="254" required>
      <button>Отправить приглашение</button>
    </form>
    <h2>Выданные доступы</h2>
    ${list ? `<ul>${list}</ul>` : '<p>Приглашений пока нет.</p>'}`);
}

module.exports = { admin, confirm, login, page };
