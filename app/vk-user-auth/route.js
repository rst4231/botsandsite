export const runtime = 'nodejs';

const HTML = String.raw`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>VK user token</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f6f8;color:#111;margin:0;padding:24px}
    .card{max-width:680px;margin:40px auto;background:#fff;border-radius:24px;padding:28px;box-shadow:0 16px 60px rgba(0,0,0,.08)}
    h1{font-size:28px;margin:0 0 14px} p{line-height:1.5;color:#444}
    input{width:100%;box-sizing:border-box;padding:14px 16px;border:1px solid #d7dbe2;border-radius:12px;font-size:17px;margin:8px 0 12px}
    button{border:0;border-radius:12px;background:#07f;color:#fff;font-size:17px;font-weight:700;padding:14px 18px;width:100%;cursor:pointer}
    code{display:block;overflow-wrap:anywhere;background:#f2f4f7;padding:12px;border-radius:10px;color:#222}
    .status{margin-top:16px;padding:14px;border-radius:12px;background:#f2f4f7;white-space:pre-wrap}
    .ok{background:#e9f8ee;color:#126b32}.err{background:#fff0f0;color:#a32121}
  </style>
  <script src="https://unpkg.com/@vkid/sdk@2.6.1/dist-sdk/umd/index.js"></script>
</head>
<body>
  <div class="card">
    <h1>Подключение пользовательского VK API</h1>
    <p>Эта страница получает пользовательский токен через VK ID и сразу проверяет, разрешена ли загрузка фото на стену сообщества.</p>
    <p><b>Redirect URL для приложения:</b></p>
    <code id="redirect"></code>
    <div id="setup">
      <p>Вставь APP_ID созданного приложения VK ID:</p>
      <input id="appId" inputmode="numeric" placeholder="Например: 12345678" />
      <button id="login">Войти через VK и дать доступ</button>
    </div>
    <div id="status" class="status">Ожидаю APP_ID.</div>
  </div>
<script>
(() => {
  const redirectUrl = location.origin + '/vk-user-auth';
  document.getElementById('redirect').textContent = redirectUrl;
  const statusEl = document.getElementById('status');
  const appInput = document.getElementById('appId');
  const params = new URLSearchParams(location.search);
  const VKID = window.VKIDSDK;

  function setStatus(text, type='') {
    statusEl.textContent = text;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }
  function base64url(bytes) {
    let s=''; bytes.forEach(b => s += String.fromCharCode(b));
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function randomToken(size=48) {
    const bytes = new Uint8Array(size); crypto.getRandomValues(bytes); return base64url(bytes);
  }
  async function challengeFor(verifier) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return base64url(new Uint8Array(digest));
  }
  async function config(app, state, verifier) {
    const codeChallenge = await challengeFor(verifier);
    VKID.Config.init({
      app: Number(app),
      redirectUrl,
      state,
      codeChallenge,
      scope: 'wall photos groups',
      mode: VKID.ConfigAuthMode.Redirect,
    });
  }

  const rememberedApp = sessionStorage.getItem('vk_auth_app') || localStorage.getItem('vk_auth_app') || '';
  if (rememberedApp) appInput.value = rememberedApp;

  document.getElementById('login').addEventListener('click', async () => {
    try {
      const app = appInput.value.trim();
      if (!/^\d+$/.test(app)) return setStatus('Нужен числовой APP_ID.', 'err');
      const state = randomToken(24);
      const verifier = randomToken(64);
      sessionStorage.setItem('vk_auth_app', app);
      localStorage.setItem('vk_auth_app', app);
      sessionStorage.setItem('vk_auth_state', state);
      sessionStorage.setItem('vk_auth_verifier', verifier);
      await config(app, state, verifier);
      setStatus('Перенаправляю в VK…');
      await VKID.Auth.login();
    } catch (e) {
      setStatus('Ошибка запуска VK ID: ' + (e?.message || e), 'err');
    }
  });

  const code = params.get('code');
  const deviceId = params.get('device_id');
  const returnedState = params.get('state');
  if (code && deviceId) {
    (async () => {
      try {
        setStatus('VK вернул код. Обмениваю его на пользовательский access token…');
        const app = sessionStorage.getItem('vk_auth_app') || localStorage.getItem('vk_auth_app');
        const state = sessionStorage.getItem('vk_auth_state');
        const verifier = sessionStorage.getItem('vk_auth_verifier');
        if (!app || !state || !verifier) throw new Error('Не найдены данные PKCE. Запусти авторизацию ещё раз с этой страницы.');
        if (returnedState !== state) throw new Error('VK state не совпал. Авторизация остановлена.');
        await config(app, state, verifier);
        const tokens = await VKID.Auth.exchangeCode(code, deviceId, verifier);
        if (!tokens?.access_token) throw new Error('VK не вернул access_token.');

        setStatus('Токен получен. Проверяю право загружать фото на стену группы…');
        const response = await fetch('/api/vk/save-user-token-temp', {
          method: 'POST',
          headers: {'content-type':'application/json'},
          body: JSON.stringify({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || '',
            expiresIn: tokens.expires_in || 0,
            scope: tokens.scope || '',
            userId: tokens.user_id || null,
            appId: Number(app),
            deviceId,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Проверка токена не прошла');
        sessionStorage.removeItem('vk_auth_state');
        sessionStorage.removeItem('vk_auth_verifier');
        history.replaceState({}, '', '/vk-user-auth');
        setStatus('ГОТОВО. Пользовательский токен сохранён.\nUser ID: ' + result.userId + '\nЗагрузка фото на стену: разрешена\nRefresh token: ' + (result.refreshTokenStored ? 'сохранён' : 'не получен'), 'ok');
      } catch (e) {
        setStatus('Ошибка: ' + (e?.message || e), 'err');
      }
    })();
  }
})();
</script>
</body>
</html>`;

export async function GET() {
  return new Response(HTML, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
