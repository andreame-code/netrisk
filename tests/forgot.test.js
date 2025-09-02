describe('forgot page', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = `
      <form id="forgotForm">
        <input id="email" />
        <button type="submit">Invia</button>
      </form>
      <p id="message" role="alert"></p>
    `;
  });

  test('shows message when supabase not configured', async () => {
    const navigateTo = jest.fn();
    jest.doMock('../src/navigation.js', () => ({ navigateTo }));
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: null,
    }));
    require('../src/forgot.js');
    document.getElementById('email').value = 'foo@example.com';
    document.getElementById('forgotForm').dispatchEvent(new Event('submit'));
    await Promise.resolve();
    expect(document.getElementById('message').textContent).toBe('Supabase non configurato');
    expect(navigateTo).not.toHaveBeenCalled();
  });

  test('redirects after requesting password reset', async () => {
    jest.useFakeTimers();
    const navigateTo = jest.fn();
    jest.doMock('../src/navigation.js', () => ({ navigateTo }));
    const resetPasswordForEmail = jest.fn().mockResolvedValue({ error: null });
    jest.doMock('../src/init/supabase-client.js', () => ({
      __esModule: true,
      default: { auth: { resetPasswordForEmail } },
    }));
    require('../src/forgot.js');
    document.getElementById('email').value = 'foo@example.com';
    document.getElementById('forgotForm').dispatchEvent(new Event('submit'));
    await Promise.resolve();
    const msg = "Se l'email esiste, riceverai un link per reimpostare la password";
    expect(document.getElementById('message').textContent).toBe(msg);
    jest.runAllTimers();
    expect(navigateTo).toHaveBeenCalledWith(`login.html?message=${encodeURIComponent(msg)}`);
    jest.useRealTimers();
  });
});
