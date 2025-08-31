import supabase from '../init/supabase-client.js';

export function setupAuthForm(formId, handler) {
  const form = document.getElementById(formId);
  const message = document.getElementById('message');
  const params = new URLSearchParams(window.location.search);
  const initialMsg = params.get('message');
  if (initialMsg) message.textContent = initialMsg;
  const submitBtn = form?.querySelector('button[type="submit"]');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabase) {
      message.textContent = 'Supabase non configurato';
      return;
    }
    submitBtn.disabled = true;
    message.textContent = '';
    try {
      await handler({ supabase, message, form, submitBtn });
    } finally {
      submitBtn.disabled = false;
    }
  });
  return { form, message, submitBtn, supabase };
}
