'use client';

import { useEffect, useState } from 'react';

const DEFAULT_APP_ID = '54727129';
const VK_SCOPE = 'wall photos groups';
const VK_ID_VERSION = '2.6.1';

function base64url(bytes) {
  let value = '';
  bytes.forEach((byte) => { value += String.fromCharCode(byte); });
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomToken(size = 48) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function codeChallengeFor(codeVerifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return base64url(new Uint8Array(digest));
}

function errorText(error) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error); } catch { return String(error); }
}

export default function VkUserAuthPage() {
  const [appId, setAppId] = useState(DEFAULT_APP_ID);
  const [redirectUrl, setRedirectUrl] = useState('');
  const [status, setStatus] = useState('APP_ID уже подставлен. Нажми кнопку ниже.');
  const [statusType, setStatusType] = useState('');

  useEffect(() => {
    const redirect = `${window.location.origin}/vk-user-auth`;
    setRedirectUrl(redirect);

    const rememberedApp = sessionStorage.getItem('vk_auth_app') || localStorage.getItem('vk_auth_app') || DEFAULT_APP_ID;
    setAppId(rememberedApp);

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const deviceId = params.get('device_id');
    const returnedState = params.get('state');
    const oauthError = params.get('error');
    const oauthErrorDescription = params.get('error_description');

    if (oauthError) {
      setStatusType('err');
      setStatus(`VK вернул ошибку: ${oauthErrorDescription || oauthError}`);
      return;
    }
    if (!code || !deviceId) return;

    (async () => {
      try {
        setStatusType('');
        setStatus('VK вернул код. Получаю пользовательский access token…');

        const app = sessionStorage.getItem('vk_auth_app') || localStorage.getItem('vk_auth_app');
        const state = sessionStorage.getItem('vk_auth_state');
        const codeVerifier = sessionStorage.getItem('vk_auth_verifier');

        if (!app || !state || !codeVerifier) throw new Error('Не найдены данные PKCE. Нажми кнопку авторизации ещё раз.');
        if (returnedState !== state) throw new Error('VK state не совпал. Авторизация остановлена.');

        const response = await fetch('/api/vk/save-user-token-temp', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            code,
            appId: Number(app),
            deviceId,
            codeVerifier,
            state,
            redirectUrl: redirect,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Проверка токена не прошла');

        sessionStorage.removeItem('vk_auth_state');
        sessionStorage.removeItem('vk_auth_verifier');
        window.history.replaceState({}, '', '/vk-user-auth');
        setStatusType('ok');
        setStatus(`ГОТОВО. Пользовательский токен сохранён.\nUser ID: ${result.userId}\nЗагрузка фото на стену: разрешена\nRefresh token: ${result.refreshTokenStored ? 'сохранён' : 'не получен'}`);
      } catch (error) {
        setStatusType('err');
        setStatus(`Ошибка: ${errorText(error)}`);
      }
    })();
  }, []);

  async function login() {
    try {
      const app = appId.trim();
      if (!/^\d+$/.test(app)) {
        setStatusType('err');
        setStatus('Нужен числовой APP_ID.');
        return;
      }

      const redirect = `${window.location.origin}/vk-user-auth`;
      const state = randomToken(24);
      const codeVerifier = randomToken(64);
      const codeChallenge = await codeChallengeFor(codeVerifier);

      sessionStorage.setItem('vk_auth_app', app);
      localStorage.setItem('vk_auth_app', app);
      sessionStorage.setItem('vk_auth_state', state);
      sessionStorage.setItem('vk_auth_verifier', codeVerifier);

      const query = new URLSearchParams({
        client_id: app,
        app_id: app,
        redirect_uri: redirect,
        response_type: 'code',
        scope: VK_SCOPE,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 's256',
        v: VK_ID_VERSION,
        sdk_type: 'vkid',
      });

      setStatusType('');
      setStatus('Перенаправляю в VK…');
      window.location.assign(`https://id.vk.ru/authorize?${query.toString()}`);
    } catch (error) {
      setStatusType('err');
      setStatus(`Ошибка запуска VK ID: ${errorText(error)}`);
    }
  }

  const styles = {
    page: { fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', background: '#f5f6f8', color: '#111', minHeight: '100vh', padding: 24 },
    card: { maxWidth: 680, margin: '40px auto', background: '#fff', borderRadius: 24, padding: 28, boxShadow: '0 16px 60px rgba(0,0,0,.08)' },
    title: { fontSize: 28, margin: '0 0 14px' },
    paragraph: { lineHeight: 1.5, color: '#444' },
    code: { display: 'block', overflowWrap: 'anywhere', background: '#f2f4f7', padding: 12, borderRadius: 10, color: '#222' },
    input: { width: '100%', boxSizing: 'border-box', padding: '14px 16px', border: '1px solid #d7dbe2', borderRadius: 12, fontSize: 17, margin: '8px 0 12px' },
    button: { border: 0, borderRadius: 12, background: '#07f', color: '#fff', fontSize: 17, fontWeight: 700, padding: '14px 18px', width: '100%', cursor: 'pointer' },
    status: { marginTop: 16, padding: 14, borderRadius: 12, whiteSpace: 'pre-wrap', background: statusType === 'ok' ? '#e9f8ee' : statusType === 'err' ? '#fff0f0' : '#f2f4f7', color: statusType === 'ok' ? '#126b32' : statusType === 'err' ? '#a32121' : '#222' },
  };

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.title}>Подключение пользовательского VK API</h1>
        <p style={styles.paragraph}>Страница использует прямую авторизацию VK ID и сразу проверяет загрузку фото на стену сообщества.</p>
        <p style={styles.paragraph}><b>Redirect URL для приложения:</b></p>
        <code style={styles.code}>{redirectUrl || 'https://traffic-news-telegram-bot.vercel.app/vk-user-auth'}</code>
        <p style={styles.paragraph}>APP_ID:</p>
        <input value={appId} onChange={(event) => setAppId(event.target.value)} inputMode="numeric" style={styles.input} />
        <button type="button" onClick={login} style={styles.button}>Войти через VK и дать доступ</button>
        <div style={styles.status}>{status}</div>
      </section>
    </main>
  );
}
