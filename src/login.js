import { setupAuthForm } from './utils/auth-forms.js';
import { navigateTo } from './navigation.js';
import { getSafeReferrer } from './utils/referrer.js';

const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const anonymousBtn = document.getElementById('anonymousBtn');
const stayLoggedIn = document.getElementById('stayLoggedIn');
const params = new URLSearchParams(window.location.search);
const redirectParam = params.get('redirect');

const { message, supabase } = setupAuthForm('loginForm', async ({ supabase, message }) => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const persistent = stayLoggedIn?.checked;
  supabase.auth.storage = persistent ? window.localStorage : window.sessionStorage;
  if (!persistent) {
    try {
      window.localStorage.removeItem('supabase.auth.token');
    } catch {
      // ignore
    }
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: username,
    password,
  });
  if (error) {
    message.textContent = 'Credenziali non valide';
    return;
  }
  if (data?.session) {
    await supabase.auth.setSession(data.session);
  }
  const name = data.user?.email?.split('@')[0] || username;
  message.textContent = `Benvenuto, ${name} 👋`;
  let ref = null;
  if (redirectParam) {
    try {
      const decoded = decodeURIComponent(redirectParam);
      const url = new URL(decoded, window.location.href);
      if (url.origin === window.location.origin) {
        ref = url.pathname.replace(/^\//, '') + url.search + url.hash;
      }
    } catch {
      ref = null;
    }
  }
  if (!ref) {
    const safeRef = getSafeReferrer();
    if (safeRef) {
      const url = new URL(safeRef, window.location.href);
      ref = url.pathname.replace(/^\//, '') + url.search + url.hash;
    }
  }
  setTimeout(() => {
    if (ref) {
      navigateTo(ref);
    } else {
      navigateTo('account.html');
    }
  }, 1000);
});

anonymousBtn?.addEventListener('click', async () => {
  if (!supabase) {
    message.textContent = 'Supabase non configurato';
    return;
  }
  if (typeof supabase.auth.signInAnonymously !== 'function') {
    message.textContent = 'Accesso anonimo non supportato';
    return;
  }
  anonymousBtn.disabled = true;
  const { error } = await supabase.auth.signInAnonymously();
  anonymousBtn.disabled = false;
  if (error) {
    message.textContent = 'Errore di accesso anonimo';
    return;
  }
  message.textContent = 'Benvenuto, giocatore 👋';
  let ref = null;
  if (redirectParam) {
    try {
      const decoded = decodeURIComponent(redirectParam);
      const url = new URL(decoded, window.location.href);
      if (url.origin === window.location.origin) {
        ref = url.pathname.replace(/^\//, '') + url.search + url.hash;
      }
    } catch {
      ref = null;
    }
  }
  if (!ref) {
    const safeRef = getSafeReferrer();
    if (safeRef) {
      const url = new URL(safeRef, window.location.href);
      ref = url.pathname.replace(/^\//, '') + url.search + url.hash;
    }
  }
  setTimeout(() => {
    if (ref) {
      navigateTo(ref);
    } else {
      navigateTo('account.html');
    }
  }, 1000);
});
